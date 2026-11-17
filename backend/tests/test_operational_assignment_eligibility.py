import pytest
from sqlalchemy import event

from app.models.company_membership import CompanyMembership
from app.models.notification import Notification
from app.models.permission_profile import MembershipPermissionProfileAssignment
from app.models.permission_profile import MembershipPermissionProfileScope
from app.models.task_item import TaskItem
from app.services import (
    organization_bootstrap_service,
    task_lifecycle_notification_service,
)
from app.services.operational_recipient_service import eligible_ids
from app.services.organization_base_profile_service import (
    FINANCE_PROFILE_NAME,
    OPERATIONS_PROFILE_NAME,
)
from test_assignable_users import _assign_profile
import test_task_direct_assignment as direct_assignment
from tests.test_task_security_delivery import _headers

assignment_setup = direct_assignment.assignment_setup


def test_manage_without_read_does_not_make_a_person_an_assignable_recipient(client, db, configured_assignment):
    from app.schemas.organization import PermissionProfileCreate
    from app.services import organization_service
    from app.services.organization_authorization_service import has_capability

    admin, target, _, location = configured_assignment
    profile = organization_service.create_permission_profile(
        db, PermissionProfileCreate(name="Manage without read", permission_codes=["work.manage"]), admin)
    _assign_profile(db, company=admin.company, admin=admin, target_user=target, profile_name=profile.name)
    assert has_capability(db, target, "work.manage")
    assert not has_capability(db, target, "work.read")
    response = client.get("/api/v1/users/assignable", headers=_headers(target))
    assert response.status_code == 200, response.text
    assert target.id not in {row["id"] for row in response.json()}
    response = client.post("/api/v1/task-items/", headers=_headers(admin), json={
        "title": "Unreadable assignment", "unit": "service", "location_id": location.id, "user_id": target.id})
    assert response.status_code == 400, response.text


@pytest.fixture
def configured_assignment(db, assignment_setup):
    admin, worker, second, location, _ = assignment_setup
    for user in (admin, worker, second):
        organization_bootstrap_service.ensure_user_membership(db, user)
    db.commit()
    _assign_profile(
        db,
        company=admin.company,
        admin=admin,
        target_user=worker,
        profile_name=FINANCE_PROFILE_NAME,
    )
    return admin, worker, second, location


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("assignment", ["direct", "description"])
def test_nonoperational_profile_cannot_be_assigned_or_notified(
    client, db, configured_assignment, operation, assignment
):
    admin, finance, worker, location = configured_assignment
    payload = {"title": "Eligibility", "unit": "service", "location_id": location.id}
    target = {"user_id": finance.id}
    if assignment == "description":
        from app.services.task_assignment_service import assign_to_users

        target = {"description": assign_to_users("- [ ] Restricted step", {finance.id})}
    if operation == "create":
        response = client.post(
            "/api/v1/task-items/", headers=_headers(admin), json=payload | target
        )
    else:
        created = client.post(
            "/api/v1/task-items/",
            headers=_headers(admin),
            json=payload | {"user_id": worker.id},
        )
        assert created.status_code == 201, created.text
        response = client.patch(
            f"/api/v1/task-items/{created.json()['id']}",
            headers=_headers(admin),
            json=target,
        )
    assert response.status_code == 400, response.text
    assert (
        db.query(Notification)
        .filter_by(user_id=finance.id, event_type="task.assigned")
        .count()
        == 0
    )


def test_revoked_empty_and_suspended_members_never_regain_legacy_eligibility(
    db, configured_assignment
):
    admin, finance, worker, location = configured_assignment
    _assign_profile(
        db,
        company=admin.company,
        admin=admin,
        target_user=finance,
        profile_name=OPERATIONS_PROFILE_NAME,
    )
    assert finance.id in eligible_ids(
        db, admin.company_id, {finance.id}, location_id=location.id
    )
    membership = (
        db.query(CompanyMembership)
        .filter_by(user_id=finance.id, company_id=admin.company_id)
        .one()
    )
    db.query(MembershipPermissionProfileAssignment).filter_by(
        company_membership_id=membership.id
    ).update({"is_active": False})
    membership.permissions_configured = False
    db.flush()
    assert (
        eligible_ids(db, admin.company_id, {finance.id}, location_id=location.id)
        == set()
    )
    worker_membership = (
        db.query(CompanyMembership)
        .filter_by(user_id=worker.id, company_id=admin.company_id)
        .one()
    )
    worker_membership.permissions_configured = True
    db.flush()
    assert eligible_ids(db, admin.company_id, {worker.id}) == set()
    worker_membership.permissions_configured = False
    worker_membership.status = "suspended"
    db.flush()
    assert eligible_ids(db, admin.company_id, {worker.id}) == set()


def test_delivery_filters_existing_assignments_after_permission_change(
    db, configured_assignment
):
    admin, finance, worker, location = configured_assignment
    task = TaskItem(
        company_id=admin.company_id,
        location_id=location.id,
        title="Legacy assignment",
        status="pending",
        unit="service",
    )
    db.add(task)
    db.commit()
    task_lifecycle_notification_service.notify_task_assignees(
        db, task, {finance.id, worker.id}
    )
    recipients = {
        row.user_id
        for row in db.query(Notification).filter_by(
            entity_id=task.id, event_type="task.assigned"
        )
    }
    assert recipients == {worker.id}


def test_candidate_filter_uses_one_query_for_multiple_people(db, configured_assignment):
    admin, finance, worker, location = configured_assignment
    company_id, location_id, ids = (
        admin.company_id,
        location.id,
        {admin.id, finance.id, worker.id},
    )
    statements = []

    def capture(*args):
        statements.append(args[2])

    event.listen(db.bind, "before_cursor_execute", capture)
    try:
        assert eligible_ids(db, company_id, ids, location_id=location_id) == {
            admin.id,
            worker.id,
        }
    finally:
        event.remove(db.bind, "before_cursor_execute", capture)
    assert len(statements) == 1


def test_location_scopes_are_respected_for_assignment_and_request_delivery(
    db, configured_assignment
):
    from types import SimpleNamespace
    from tests.test_task_security_delivery import _location

    admin, scoped, worker, location = configured_assignment
    _assign_profile(
        db,
        company=admin.company,
        admin=admin,
        target_user=scoped,
        profile_name=OPERATIONS_PROFILE_NAME,
    )
    membership = (
        db.query(CompanyMembership)
        .filter_by(user_id=scoped.id, company_id=admin.company_id)
        .one()
    )
    assignment = (
        db.query(MembershipPermissionProfileAssignment)
        .filter_by(company_membership_id=membership.id, is_active=True)
        .one()
    )
    scope = (
        db.query(MembershipPermissionProfileScope)
        .filter_by(profile_assignment_id=assignment.id)
        .one()
    )
    scope.scope_type, scope.scope_id = "location", location.id
    other = _location(db, admin.company)
    db.flush()
    assert scoped.id in eligible_ids(
        db, admin.company_id, {scoped.id}, location_id=location.id
    )
    assert (
        eligible_ids(db, admin.company_id, {scoped.id}, location_id=other.id) == set()
    )
    task = TaskItem(
        company_id=admin.company_id,
        location_id=location.id,
        title="Scoped request",
        status="requested",
        unit="service",
    )
    db.add(task)
    db.commit()
    task_lifecycle_notification_service.notify_request_sent(
        db, SimpleNamespace(id=991), task
    )
    assert {
        row.user_id
        for row in db.query(Notification).filter_by(
            entity_id=task.id, event_type="task.requested"
        )
    } == {admin.id, scoped.id}
