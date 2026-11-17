import pytest

from app.models.notification import Notification
import test_task_direct_assignment as direct_assignment
from tests.test_task_security_delivery import _headers


assignment_setup = direct_assignment.assignment_setup


def _unread(client, user, task_id):
    response = client.get("/api/v1/notifications/", headers=_headers(user))
    assert response.status_code == 200, response.text
    return [
        row
        for row in response.json()
        if row["entity_type"] == "task_item" and row["entity_id"] == task_id
    ]


@pytest.mark.parametrize("ending", ["completed", "rejected", "unassigned", "deleted"])
def test_assignments_stop_counting_when_the_work_is_no_longer_actionable(
    client, db, assignment_setup, ending
):
    admin, first, second, location, _ = assignment_setup
    response = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Assignment lifecycle",
            "unit": "service",
            "location_id": location.id,
            "user_id": first.id,
        },
    )
    assert response.status_code == 201, response.text
    task_id = response.json()["id"]
    initial = _unread(client, first, task_id)
    assert len(initial) == 1
    response = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={"user_id": second.id},
    )
    assert response.status_code == 200, response.text
    assert _unread(client, first, task_id) == []
    assert len(_unread(client, second, task_id)) == 1
    if ending == "deleted":
        response = client.delete(
            f"/api/v1/task-items/{task_id}", headers=_headers(admin)
        )
        assert response.status_code == 204, response.text
    else:
        payload = {"user_id": None} if ending == "unassigned" else {"status": ending}
        response = client.patch(
            f"/api/v1/task-items/{task_id}", headers=_headers(admin), json=payload
        )
        assert response.status_code == 200, response.text
    assert _unread(client, second, task_id) == []
    db.expire_all()
    # Retire the actionable count without deleting event history.
    assert db.get(Notification, initial[0]["id"]).read_at is not None


def test_retirement_preserves_other_recipients_tenants_tasks_and_event_types(db):
    from app.repositories.notification_acknowledgement import retire_task_assignments
    from test_notification_inbox_isolation import _inbox

    owner, colleague, foreign, current, historical = _inbox(db)
    for row in db.query(Notification).all():
        row.event_type = "task.assigned"
    other_event = Notification(
        user_id=owner.id,
        company_id=owner.company_id,
        event_type="task.completed",
        title="Completed",
        message="QA",
        entity_type="task_item",
        entity_id=47,
        href="/dashboard",
    )
    other_task = Notification(
        user_id=owner.id,
        company_id=owner.company_id,
        event_type="task.assigned",
        title="Other work",
        message="QA",
        entity_type="task_item",
        entity_id=48,
        href="/dashboard",
    )
    db.add_all([other_event, other_task])
    db.commit()
    retire_task_assignments(
        db, company_id=owner.company_id, task_id=47, active_user_ids={colleague.id}
    )
    db.commit()
    db.expire_all()
    assert db.get(Notification, current.id).read_at is not None
    assert db.get(Notification, historical.id).read_at is None
    assert db.query(Notification).filter_by(user_id=colleague.id).one().read_at is None
    assert db.query(Notification).filter_by(user_id=foreign.id).one().read_at is None
    assert db.get(Notification, other_event.id).read_at is None
    assert db.get(Notification, other_task.id).read_at is None


@pytest.mark.parametrize("ending", ["accept", "reject", "delete", "cancel", "cancel_accepted"])
def test_responded_requests_stop_counting_for_all_receiving_managers(client, db, ending):
    from test_task_notifications import _external_task
    from app.services.task_lifecycle_notification_service import notify_request_sent

    setup = _external_task(db)
    task = setup["task"]
    from app.models.location_company_access import LocationCompanyAccess
    db.add(LocationCompanyAccess(location_id=task.location_id, company_id=task.company_id,
                                 can_manage_tasks=True))
    db.commit()
    notify_request_sent(db, task.checkout_reservation, task)
    notices = db.query(Notification).filter_by(entity_id=task.id, event_type="task.requested").all()
    assert len(notices) == 3
    assert all(row.read_at is None for row in notices)
    if ending.startswith("cancel"):
        if ending == "cancel_accepted":
            response = client.post(f"/api/v1/task-items/{task.id}/accept", headers=_headers(setup["receiver_admin"]), json={})
            assert response.status_code == 200, response.text
            assignments = db.query(Notification).filter_by(entity_id=task.id, event_type="task.assigned").all()
            assert len(assignments) == 5
            notices.extend(assignments)
        response = client.patch(f"/api/v1/reservations/{task.checkout_reservation_id}",
                                headers=_headers(setup["owner_admin"]), json={"status": "cancelled"})
        assert response.status_code == 200, response.text
    elif ending == "delete":
        response = client.delete(f"/api/v1/task-items/{task.id}", headers=_headers(setup["receiver_admin"]))
        assert response.status_code == 204, response.text
    else:
        response = client.post(f"/api/v1/task-items/{task.id}/{ending}", headers=_headers(setup["receiver_admin"]), json={})
        assert response.status_code == 200, response.text
    db.expire_all()
    assert all(row.read_at is not None for row in notices)
