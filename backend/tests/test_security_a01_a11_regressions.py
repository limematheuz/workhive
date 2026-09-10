"""Regression tests for the verified A01-A11 security findings."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.security import get_password_hash
from app.models.company_membership import CompanyMembership
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.location_zone import LocationZone
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.template_task import TemplateTask
from app.models.work_session import WorkSession
from credentials import TEST_SECRET, login_form
from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)


def _scoped_users(db):
    company = _company(db, f"security-{uuid4().hex[:8]}")
    admin = _bootstrap_admin(db, company, f"security-admin-{uuid4().hex[:8]}")
    manager = _user(db, company, f"security-manager-{uuid4().hex[:8]}", role_id=2)
    allowed = Location(
        name="Allowed location",
        address="Allowed street",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    denied = Location(
        name="Denied location",
        address="Denied street",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add_all([allowed, denied])
    db.flush()
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=manager,
        name=f"Narrow profile {uuid4().hex[:8]}",
        permission_codes={"locations.read", "work.read"},
        scope_type="location",
        scope_id=allowed.id,
    )
    return company, admin, manager, allowed, denied


def test_a01_null_company_and_detached_tenant_access_are_blocked(client, db):
    first = _company(db, "a01-first")
    second = _company(db, "a01-second")
    viewer = _user(db, first, "a01-viewer", role_id=3)
    detached_admin = _user(db, None, "a01-detached-admin", role_id=1)
    platform = _user(db, None, "a01-platform", role_id=4)
    template = TemplateTask(
        name="Foreign recipe", company_id=second.id, default_price=10, unit="unit"
    )
    location = Location(
        name="Foreign location",
        address="Foreign street",
        city="Madrid",
        owner_company_id=second.id,
        managing_company_id=second.id,
    )
    db.add_all([template, location])
    db.flush()
    db.add(LocationZone(location_id=location.id, name="Private zone"))
    db.add(LocationTemplate(location_id=location.id, template_task_id=template.id))
    db.commit()

    detach = client.patch(
        f"/api/v1/users/{viewer.id}",
        headers=_headers(viewer),
        json={"company_id": None},
    )
    assert detach.status_code in {403, 422}
    db.refresh(viewer)
    assert viewer.company_id == first.id

    assert client.get(
        f"/api/v1/template-tasks/{template.id}", headers=_headers(detached_admin)
    ).status_code in {400, 403}
    assert client.get(
        f"/api/v1/locations/{location.id}/zones", headers=_headers(detached_admin)
    ).status_code in {400, 403}
    assert client.patch(
        f"/api/v1/users/{platform.id}",
        headers=_headers(detached_admin),
        json={"is_active": False},
    ).status_code in {400, 403}


def test_a04_legacy_users_and_invitations_use_member_capabilities(
    client, db, monkeypatch
):
    company, admin, manager, _, _ = _scoped_users(db)
    manager_headers = _headers(manager)
    membership = (
        db.query(CompanyMembership)
        .filter_by(company_id=company.id, user_id=admin.id)
        .one()
    )

    assert (
        client.patch(
            f"/api/v1/organization/members/{membership.id}",
            headers=manager_headers,
            json={"status": "suspended"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/users/{admin.id}",
            headers=manager_headers,
            json={"is_active": False},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/user-invitations/",
            headers=manager_headers,
            json={"email": "blocked-invite@example.com", "role_id": 3},
        ).status_code
        == 403
    )
    assert (
        client.get("/api/v1/user-invitations/", headers=manager_headers).status_code
        == 403
    )

    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        lambda **_kwargs: True,
    )
    assert (
        client.post(
            "/api/v1/user-invitations/",
            headers=_headers(admin),
            json={"email": "allowed-invite@example.com", "role_id": 3},
        ).status_code
        == 202
    )


def test_a02_location_children_and_import_honor_profile_scope(client, db):
    _, _, manager, allowed, denied = _scoped_users(db)
    db.add(LocationZone(location_id=denied.id, name="Denied zone"))
    db.commit()
    headers = _headers(manager)

    assert (
        client.get(
            f"/api/v1/locations/{allowed.id}/spaces", headers=headers
        ).status_code
        == 200
    )
    for child in ("spaces", "zones", "templates"):
        assert (
            client.get(
                f"/api/v1/locations/{denied.id}/{child}", headers=headers
            ).status_code
            == 403
        )
    assert (
        client.post(
            f"/api/v1/locations/{denied.id}/spaces",
            headers=headers,
            json={"name": "Blocked", "space_type": "other"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/locations/import",
            headers=headers,
            json={"csv_content": "name,address,city\nBlocked,Street,Madrid\n"},
        ).status_code
        == 403
    )


def test_a03_task_reports_honor_work_scope_for_all_operations(client, db):
    company, admin, manager, allowed, denied = _scoped_users(db)
    denied_task = TaskItem(
        title="Denied task",
        company_id=company.id,
        location_id=denied.id,
        status="pending",
        price=1,
        quantity=1,
        unit="unit",
    )
    allowed_task = TaskItem(
        title="Allowed task",
        company_id=company.id,
        location_id=allowed.id,
        status="pending",
        price=1,
        quantity=1,
        unit="unit",
    )
    db.add_all([denied_task, allowed_task])
    db.commit()
    denied_created = client.post(
        "/api/v1/task-reports/",
        headers=_headers(admin),
        json={
            "task_item_id": denied_task.id,
            "client_event_id": str(uuid4()),
            "report_type": "issue",
            "title": "Restricted report",
        },
    )
    assert denied_created.status_code == 201, denied_created.text
    denied_report_id = denied_created.json()["id"]
    allowed_created = client.post(
        "/api/v1/task-reports/",
        headers=_headers(admin),
        json={
            "task_item_id": allowed_task.id,
            "client_event_id": str(uuid4()),
            "report_type": "issue",
            "title": "Allowed report",
        },
    )
    assert allowed_created.status_code == 201, allowed_created.text
    allowed_report_id = allowed_created.json()["id"]
    headers = _headers(manager)

    assert (
        client.post(
            "/api/v1/task-reports/",
            headers=headers,
            json={
                "task_item_id": denied_task.id,
                "client_event_id": str(uuid4()),
                "report_type": "issue",
                "title": "Blocked",
            },
        ).status_code
        == 403
    )
    listed = client.get("/api/v1/task-reports/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [report["id"] for report in listed.json()] == [allowed_report_id]
    assert (
        client.get(f"/api/v1/task-reports/{denied_report_id}", headers=headers).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/task-reports/{allowed_report_id}",
            headers=headers,
            json={"title": "Blocked edit"},
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/api/v1/task-reports/{allowed_report_id}", headers=headers).status_code
        == 403
    )


def test_a05_and_a09_reservation_visibility_is_consistent(client, db):
    company, admin, manager, allowed, denied = _scoped_users(db)
    now = datetime.now(timezone.utc)
    allowed_reservation = Reservation(
        location_id=allowed.id,
        owner_company_id=company.id,
        check_in_at=now + timedelta(days=1),
        check_out_at=now + timedelta(days=2),
        created_by_user_id=admin.id,
    )
    denied_reservation = Reservation(
        location_id=denied.id,
        owner_company_id=company.id,
        check_in_at=now + timedelta(days=1),
        check_out_at=now + timedelta(days=2),
        created_by_user_id=admin.id,
    )
    other = _company(db, "a09-other")
    shared = Location(
        name="Shared location",
        address="Shared street",
        city="Madrid",
        owner_company_id=other.id,
        managing_company_id=other.id,
    )
    db.add_all([allowed_reservation, denied_reservation, shared])
    db.flush()
    db.add(
        LocationCompanyAccess(
            location_id=shared.id,
            company_id=company.id,
            relationship_type="service_provider",
            can_manage_reservations=False,
            can_manage_tasks=True,
            can_view_sensitive=False,
        )
    )
    foreign = Reservation(
        location_id=shared.id,
        owner_company_id=other.id,
        check_in_at=now,
        check_out_at=now + timedelta(days=1),
    )
    db.add(foreign)
    db.commit()

    manager_headers = _headers(manager)
    listed = client.get("/api/v1/reservations/", headers=manager_headers)
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()] == [allowed_reservation.id]
    assert (
        client.get(
            f"/api/v1/reservations/{denied_reservation.id}", headers=manager_headers
        ).status_code
        == 403
    )
    arrivals = client.get(
        "/api/v1/reservations/upcoming/arrivals", headers=manager_headers
    )
    assert [row["id"] for row in arrivals.json()] == [allowed_reservation.id]

    admin_headers = _headers(admin)
    assert foreign.id not in [
        row["id"]
        for row in client.get("/api/v1/reservations/", headers=admin_headers).json()
    ]
    assert (
        client.get(
            f"/api/v1/reservations/{foreign.id}", headers=admin_headers
        ).status_code
        == 404
    )


def test_a10_and_a11_finance_and_time_capabilities_are_enforced(client, db):
    company, admin, manager, allowed, denied = _scoped_users(db)
    provider = _company(db, "a10-provider")
    worker = _user(db, company, "a11-worker", role_id=3)
    now = datetime.now(timezone.utc)
    reservation = Reservation(
        location_id=denied.id,
        owner_company_id=company.id,
        assigned_company_id=provider.id,
        check_in_at=now,
        check_out_at=now + timedelta(days=1),
    )
    db.add(reservation)
    db.flush()
    db.add(
        TaskItem(
            title="Private cost",
            company_id=provider.id,
            location_id=denied.id,
            checkout_reservation_id=reservation.id,
            status="completed",
            date_done=now,
            price=987,
            quantity=1,
            unit="unit",
        )
    )
    db.add(
        WorkSession(
            user_id=worker.id,
            location_id=denied.id,
            start_time=now - timedelta(hours=3),
            end_time=now,
        )
    )
    db.commit()
    headers = _headers(manager)

    assert (
        client.get(
            f"/api/v1/companies/{company.id}/expenses", headers=headers
        ).status_code
        == 403
    )
    assert (
        client.get(f"/api/v1/users/{worker.id}/stats", headers=headers).status_code
        == 403
    )

    time_reader = _user(db, company, "a11-time-reader", role_id=2)
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=time_reader,
        name="Scoped time reader",
        permission_codes={"time.read"},
        scope_type="location",
        scope_id=allowed.id,
    )
    db.add(
        WorkSession(
            user_id=worker.id,
            location_id=allowed.id,
            start_time=now - timedelta(hours=2),
            end_time=now,
        )
    )
    db.commit()
    stats = client.get(
        f"/api/v1/users/{worker.id}/stats", headers=_headers(time_reader)
    )
    assert stats.status_code == 200, stats.text
    assert stats.json()["total_hours_worked"] == 2


def test_a08_password_change_revokes_the_previous_session(client, db):
    company = _company(db, "a08")
    admin = _bootstrap_admin(db, company, "a08-admin")
    admin.email = "a08-admin@example.com"
    admin.hashed_password = get_password_hash(TEST_SECRET)
    db.commit()
    old_headers = _headers(admin)
    changed = client.patch(
        f"/api/v1/users/{admin.id}",
        headers=old_headers,
        json={"old_password": TEST_SECRET, "password": "New-Password-2!"},
    )
    assert changed.status_code == 200, changed.text
    assert client.get("/api/v1/users/me", headers=old_headers).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", data=login_form(admin.email, TEST_SECRET)
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", data=login_form(admin.email, "New-Password-2!")
        ).status_code
        == 200
    )
