import pytest

from tests.test_client_permission_authorization import _assign_company_profile
from tests.test_organization_api import _bootstrap_admin, _company, _headers, _user
from tests.test_quality_templates import _location
from app.services.organization_authorization_service import has_capability


@pytest.mark.parametrize(
    "section", ["templates", "inspections", "incidents", "complaints"]
)
def test_location_scoped_quality_permissions_are_visible_without_company_wide_access(
    client, db, section
):
    company = _company(db, "quality-local-access")
    admin = _bootstrap_admin(db, company, "quality-local-owner")
    user = _user(db, company, "quality-local-member", 3)
    user.email = "quality-local-member@example.com"
    db.commit()
    location = _location(db, company, "Allowed quality site")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=user,
        name="Local quality",
        permission_codes={f"quality.{section}.read", f"quality.{section}.manage"},
        scope_type="location",
        scope_id=location.id,
    )
    headers = _headers(user)
    # Presentation must recognize local rights without granting company-wide rights.
    assert has_capability(db, user, f"quality.{section}.read") is False
    assert has_capability(db, user, f"quality.{section}.manage") is False
    assert client.get(f"/api/v1/quality/{section}/", headers=headers).status_code == 200
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["can_view_quality"] is True
    assert me.json()["can_manage_quality"] is True
    access = client.get("/api/v1/quality/access", headers=headers)
    assert access.status_code == 200, access.text
    assert access.json()["sections"][section] == {
        "can_read": True,
        "can_manage": True,
        "read_locations": [location.id],
        "manage_locations": [location.id],
    }
    for other in {"templates", "inspections", "incidents", "complaints"} - {section}:
        assert access.json()["sections"][other] == {
            "can_read": False,
            "can_manage": False,
            "read_locations": [],
            "manage_locations": [],
        }
    assert access.json()["can_read_locations"] is False
    summary = client.get("/api/v1/organization/access", headers=headers)
    assert summary.status_code == 200
    assert summary.json()[f"quality.{section}.read"] is True
    assert summary.json()[f"quality.{section}.manage"] is True


@pytest.mark.parametrize("read_local", [False, True])
def test_quality_workspace_intersects_read_and_manage_scopes(client, db, read_local):
    company = _company(db, "quality-mixed")
    admin = _bootstrap_admin(db, company, "quality-mixed-owner")
    user = _user(db, company, "quality-mixed-reader", 3)
    first = _location(db, company, "Allowed")
    second = _location(db, company, "Read only")
    for operation, local in [("read", read_local), ("manage", not read_local)]:
        _assign_company_profile(
            db,
            company=company,
            admin=admin,
            user=user,
            name=f"Mixed {operation}",
            permission_codes={f"quality.incidents.{operation}"},
            scope_type="location" if local else "company",
            scope_id=first.id if local else company.id,
        )
    headers = _headers(user)
    access = client.get("/api/v1/quality/access", headers=headers)
    assert access.status_code == 200, access.text
    assert access.json()["sections"]["incidents"] == {
        "can_read": True,
        "can_manage": True,
        "read_locations": [first.id] if read_local else None,
        "manage_locations": [first.id],
    }
    records = []
    for location in [first, second]:
        created = client.post(
            "/api/v1/quality/incidents/",
            headers=_headers(admin),
            json={"location_id": location.id, "title": location.name},
        )
        assert created.status_code == 201, created.text
        records.append(created.json())
    listing = client.get("/api/v1/quality/incidents/", headers=headers)
    assert {r["id"] for r in listing.json()} == {
        r["id"] for r in records[: 1 if read_local else 2]
    }
    permitted = client.patch(
        f"/api/v1/quality/incidents/{records[0]['id']}",
        headers=headers,
        json={"status": "resolved"},
    )
    assert permitted.status_code == 200, permitted.text
    if not read_local:
        denied = client.patch(
            f"/api/v1/quality/incidents/{records[1]['id']}",
            headers=headers,
            json={"status": "resolved"},
        )
        assert denied.status_code == 403, denied.text
        unchanged = client.get(
            f"/api/v1/quality/incidents/{records[1]['id']}", headers=_headers(admin)
        )
        assert unchanged.json() == records[1]


def test_quality_access_requires_authentication_and_fails_closed_without_rights(
    client, db
):
    company = _company(db, "quality-denied")
    _bootstrap_admin(db, company, "quality-denied-owner")
    user = _user(db, company, "quality-denied-user", 3)
    assert client.get("/api/v1/quality/access").status_code == 401
    response = client.get("/api/v1/quality/access", headers=_headers(user))
    assert response.status_code == 200
    assert all(
        not section["can_read"]
        and not section["can_manage"]
        and section["read_locations"] == []
        and section["manage_locations"] == []
        for section in response.json()["sections"].values()
    )


def test_quality_scope_summary_queries_do_not_grow_per_location(client, db):
    from sqlalchemy import event
    from app.models.permission_profile import (
        MembershipPermissionProfileAssignment,
        MembershipPermissionProfileScope,
        PermissionProfile,
    )

    company = _company(db, "quality-query-bound")
    admin = _bootstrap_admin(db, company, "quality-query-owner")
    user = _user(db, company, "quality-query-member", 3)
    first = _location(db, company, "Quality query first")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=user,
        name="Quality query scopes",
        permission_codes={
            f"quality.{section}.{operation}"
            for section in ["templates", "inspections", "incidents", "complaints"]
            for operation in ["read", "manage"]
        },
        scope_type="location",
        scope_id=first.id,
    )
    headers = _headers(user)

    def measure(expected_locations):
        db.expire_all()
        statements = []

        def record_statement(*args):
            statements.append(args[2])

        event.listen(db.bind, "before_cursor_execute", record_statement)
        try:
            response = client.get("/api/v1/quality/access", headers=headers)
        finally:
            event.remove(db.bind, "before_cursor_execute", record_statement)
        assert response.status_code == 200, response.text
        assert (
            set(response.json()["sections"]["incidents"]["read_locations"])
            == expected_locations
        )
        return len(statements)

    one_location_queries = measure({first.id})
    assignment = (
        db.query(MembershipPermissionProfileAssignment)
        .join(PermissionProfile)
        .filter(PermissionProfile.name == "Quality query scopes")
        .one()
    )
    expected = {first.id}
    for index in range(29):
        location = _location(db, company, f"Quality query {index}")
        expected.add(location.id)
        db.add(
            MembershipPermissionProfileScope(
                company_id=company.id,
                profile_assignment_id=assignment.id,
                scope_type="location",
                scope_id=location.id,
            )
        )
    db.commit()
    assert measure(expected) <= one_location_queries
