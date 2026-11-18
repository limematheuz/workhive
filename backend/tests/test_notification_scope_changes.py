import pytest

from app.models.notification import Notification
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.schemas.organization import OrganizationMemberProfileAssignmentsUpdate
from app.services import (
    notification_service,
    organization_bootstrap_service,
    organization_service,
)
from tests.test_task_security_delivery import _company, _headers, _location, _user
from test_assignable_users import _assign_profile


def _principal(db, company, email, role_name):
    role = db.query(Role).filter_by(name=role_name).one()
    return _user(db, company, email, role.id)


@pytest.mark.parametrize("change", ["location", "finance", "empty", "reassignment"])
def test_operational_inbox_tracks_current_read_access_before_pagination(
    client, db, change
):
    company = _company(db, "InboxScope")
    admin = _principal(db, company, "inbox-admin@example.test", "admin")
    user = _principal(db, company, "inbox-reader@example.test", "viewer")
    for principal in (admin, user):
        organization_bootstrap_service.ensure_user_membership(db, principal)
    db.commit()
    if change != "reassignment":
        _assign_profile(
            db, company=company, admin=admin, target_user=user, profile_name="Consulta"
        )
    tasks, reports, notices = [], [], []
    for index in range(2):
        location = _location(db, company)
        task = TaskItem(
            company_id=company.id,
            location_id=location.id,
            user_id=user.id,
            title=f"Restricted {index}",
            unit="service",
            status="accepted",
        )
        db.add(task)
        db.flush()
        report = TaskReport(
            task_item_id=task.id,
            reporter_user_id=user.id,
            reporter_company_id=company.id,
            client_event_id=f"inbox-scope-{index}",
            report_type="note",
            description="Private report",
            reporter_name="QA",
        )
        db.add(report)
        db.flush()
        tasks.append(task)
        reports.append(report)
        for kind, entity, identifier in [
            ("task.assigned", "task_item", task.id),
            ("task.reported", "task_report", report.id),
        ]:
            notice = Notification(
                company_id=company.id,
                user_id=user.id,
                event_type=kind,
                entity_type=entity,
                entity_id=identifier,
                title=f"Private {index}",
                message="Private data",
                href="/dashboard",
            )
            db.add(notice)
            db.flush()
            notices.append(notice)
    db.commit()
    headers = _headers(user)
    before = client.get("/api/v1/notifications/", headers=headers)
    assert before.status_code == 200
    assert len(before.json()) == 4
    if change == "finance":
        _assign_profile(
            db, company=company, admin=admin, target_user=user, profile_name="Finanzas"
        )
    elif change in {"location", "empty"}:
        member = next(
            row
            for row in organization_service.list_members(db, admin)
            if row.user_id == user.id
        )
        profile = next(
            row
            for row in organization_service.list_permission_profiles(db, admin)
            if row.name == "Consulta"
        )
        assignments = (
            []
            if change == "empty"
            else [
                {
                    "permission_profile_id": profile.id,
                    "scopes": [
                        {"scope_type": "location", "scope_id": tasks[0].location_id}
                    ],
                }
            ]
        )
        organization_service.replace_member_profile_assignments(
            db,
            member.id,
            OrganizationMemberProfileAssignmentsUpdate(assignments=assignments),
            admin,
        )
    else:
        tasks[1].user_id = admin.id
        db.commit()
    expected = (
        {notices[0].id, notices[1].id}
        if change in {"location", "reassignment"}
        else set()
    )
    for unread in ("true", "false"):
        response = client.get(
            f"/api/v1/notifications/?unread_only={unread}", headers=headers
        )
        assert response.status_code == 200
        assert {row["id"] for row in response.json()} == expected
    first_page = client.get("/api/v1/notifications/?limit=1", headers=headers)
    assert len(first_page.json()) == min(len(expected), 1)
    assert {row["id"] for row in first_page.json()} <= expected
    assert notification_service.count_unread_task_notifications(db, user) == int(
        bool(expected)
    )
    assert {
        row.id for row in notification_service.list_unread_task_notifications(db, user)
    } == ({notices[0].id} if expected else set())
    denied = client.patch(
        f"/api/v1/notifications/{notices[3].id}/read", headers=headers
    )
    assert denied.status_code == 404
    db.expire_all()
    assert db.query(Notification).count() == 4
    assert all(db.get(Notification, row.id).read_at is None for row in notices)


def test_company_wide_inbox_cannot_expose_a_reference_to_another_tenant(client, db):
    company = _company(db, "InboxRecipient")
    foreign = _company(db, "InboxForeign")
    user = _principal(db, company, "inbox-company-admin@example.test", "admin")
    location = _location(db, foreign)
    task = TaskItem(
        company_id=foreign.id,
        location_id=location.id,
        title="Foreign private work",
        unit="service",
        status="pending",
    )
    db.add(task)
    db.flush()
    notice = Notification(
        company_id=company.id,
        user_id=user.id,
        event_type="task.assigned",
        entity_type="task_item",
        entity_id=task.id,
        title="Foreign private work",
        message="Private",
        href="/dashboard",
    )
    db.add(notice)
    db.commit()
    response = client.get("/api/v1/notifications/", headers=_headers(user))
    assert response.status_code == 200
    assert response.json() == []
    assert (
        client.patch(
            f"/api/v1/notifications/{notice.id}/read", headers=_headers(user)
        ).status_code
        == 404
    )


def test_read_only_profile_does_not_keep_a_management_request_prompt(client, db):
    company = _company(db, "InboxRequest")
    admin = _principal(db, company, "request-admin@example.test", "admin")
    user = _principal(db, company, "request-reader@example.test", "viewer")
    for principal in (admin, user):
        organization_bootstrap_service.ensure_user_membership(db, principal)
    db.commit()
    _assign_profile(
        db, company=company, admin=admin, target_user=user, profile_name="Operaciones"
    )
    location = _location(db, company)
    task = TaskItem(
        company_id=company.id,
        location_id=location.id,
        title="Request",
        unit="service",
        status="requested",
    )
    db.add(task)
    db.flush()
    notice = Notification(
        company_id=company.id,
        user_id=user.id,
        event_type="task.requested",
        entity_type="task_item",
        entity_id=task.id,
        title="Request",
        message="Private",
        href="/dashboard/reservations",
    )
    db.add(notice)
    db.commit()
    headers = _headers(user)
    assert len(client.get("/api/v1/notifications/", headers=headers).json()) == 1
    _assign_profile(
        db, company=company, admin=admin, target_user=user, profile_name="Consulta"
    )
    assert (
        client.get(f"/api/v1/task-items/{task.id}", headers=headers).status_code == 200
    )
    assert client.get("/api/v1/notifications/", headers=headers).json() == []
