import pytest

from tests.test_client_permission_authorization import _assign_company_profile
from tests.test_organization_api import _bootstrap_admin, _company, _headers, _user
from tests.test_quality_templates import _location


@pytest.mark.parametrize("role_id", [2, 3])
def test_location_management_hint_matches_delegated_mutation_scope(client, db, role_id):
    company = _company(db, f"location-management-{role_id}")
    admin = _bootstrap_admin(db, company, f"location-management-owner-{role_id}")
    member = _user(db, company, f"location-management-member-{role_id}", role_id)
    allowed = _location(db, company, "Managed site")
    read_only = _location(db, company, "Read-only site")
    _assign_company_profile(
        db, company=company, admin=admin, user=member, name="Read locations",
        permission_codes={"locations.read"},
    )
    _assign_company_profile(
        db, company=company, admin=admin, user=member, name="Manage one location",
        permission_codes={"locations.manage"}, scope_type="location", scope_id=allowed.id,
    )
    headers = _headers(member)
    listing = client.get("/api/v1/locations/", headers=headers)
    assert listing.status_code == 200, listing.text
    flags = {row["id"]: row["can_manage_location"] for row in listing.json()}
    assert flags == {allowed.id: True, read_only.id: False}
    original = client.get(f"/api/v1/locations/{read_only.id}", headers=headers).json()
    denied = client.patch(
        f"/api/v1/locations/{read_only.id}", headers=headers, json={"name": "Denied change"},
    )
    assert denied.status_code == 403, denied.text
    assert client.get(f"/api/v1/locations/{read_only.id}", headers=headers).json() == original
    changed = client.patch(
        f"/api/v1/locations/{allowed.id}", headers=headers, json={"name": "Managed change"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["name"] == "Managed change"


@pytest.mark.parametrize("scope", ["none", "location", "company"])
def test_location_read_hint_matches_the_actual_listing_scope(client, db, scope):
    company = _company(db, "location-summary")
    owner = _bootstrap_admin(db, company, "location-summary-owner")
    user = _user(db, company, "location-summary-member", 3)
    first = _location(db, company, "Allowed site")
    second = _location(db, company, "Other site")
    _assign_company_profile(
        db,
        company=company,
        admin=owner,
        user=user,
        name="Location reader",
        permission_codes={"inventory.read"} if scope == "none" else {"locations.read"},
        scope_type="location" if scope == "location" else "company",
        scope_id=first.id if scope == "location" else company.id,
    )
    headers = _headers(user)
    hint = client.get("/api/v1/organization/access", headers=headers)
    assert hint.status_code == 200, hint.text
    assert hint.json()["locations.read"] is (scope != "none")
    response = client.get("/api/v1/locations/", headers=headers)
    assert response.status_code == (403 if scope == "none" else 200), response.text
    if scope != "none":
        assert {row["id"] for row in response.json()} == (
            {first.id} if scope == "location" else {first.id, second.id}
        )
        assert all(
            not value
            for key, value in hint.json().items()
            if key.startswith("quality.")
        )
