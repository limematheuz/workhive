import pytest

from app.models.notification import Notification
from tests.test_task_notifications import _external_task, _headers
from tests.test_task_report_center import _accept_external_task, _report_payload


@pytest.mark.parametrize("destination", ["unrelated_admin", "receiver_admin", None])
def test_report_notice_does_not_follow_a_departed_reservation_emitter(
    client, db, destination
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    emitter = users["owner_emitter"]
    emitter.company_id = users[destination].company_id if destination else None
    db.commit()
    response = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_admin"]),
        json=_report_payload(task.id),
    )
    assert response.status_code == 201, response.text
    report_id = response.json()["id"]
    notices = (
        db.query(Notification)
        .filter(
            Notification.entity_type == "task_report",
            Notification.entity_id == report_id,
        )
        .all()
    )
    assert emitter.id not in {notice.user_id for notice in notices}
    assert {notice.user_id for notice in notices} == {
        users[key].id
        for key in ["owner_admin", "receiver_admin", "second_receiver_admin"]
    }
    assert {notice.company_id for notice in notices} == {
        users["owner_admin"].company_id,
        users["receiver_admin"].company_id,
    }
