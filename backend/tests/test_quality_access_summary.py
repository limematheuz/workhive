import pytest

from app.models.permission_profile import PermissionProfile
from tests.test_client_permission_authorization import _assign_company_profile
from tests.test_organization_api import _bootstrap_admin, _company, _headers, _user


@pytest.mark.parametrize(
    "section", ["templates", "inspections", "incidents", "complaints"]
)
def test_quality_access_summary_matches_scoped_endpoints_and_revocation(
    client, db, section
):
    company = _company(db, "quality-summary")
    admin = _bootstrap_admin(db, company, "quality-summary-admin")
    reader = _user(db, company, "quality-summary-reader", 3)
    read_code = f"quality.{section}.read"
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=reader,
        name="Quality summary reader",
        permission_codes={read_code},
    )
    headers = _headers(reader)
    summary = client.get("/api/v1/organization/access", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json().get(read_code) is True
    assert summary.json().get("locations.read") is False
    for resource in ["templates", "inspections", "incidents", "complaints"]:
        assert summary.json().get(f"quality.{resource}.read") is (resource == section)
        assert summary.json().get(f"quality.{resource}.manage") is False
        assert client.get(
            f"/api/v1/quality/{resource}/", headers=headers
        ).status_code == (200 if resource == section else 403)
    profile = (
        db.query(PermissionProfile)
        .filter_by(company_id=company.id, name="Quality summary reader")
        .one()
    )
    revoked = client.patch(
        f"/api/v1/organization/permission-profiles/{profile.id}",
        headers=_headers(admin),
        json={"is_active": False},
    )
    assert revoked.status_code == 200, revoked.text
    after = client.get("/api/v1/organization/access", headers=headers)
    assert after.status_code == 200
    assert all(
        after.json().get(f"quality.{resource}.{operation}") is False
        for resource in ["templates", "inspections", "incidents", "complaints"]
        for operation in ["read", "manage"]
    )
    assert client.get(f"/api/v1/quality/{section}/", headers=headers).status_code == 403

    scoped_after = client.get("/api/v1/quality/access", headers=headers)
    assert scoped_after.status_code == 200
    assert all(
        not scope["can_read"]
        and not scope["can_manage"]
        and scope["read_locations"] == []
        and scope["manage_locations"] == []
        for scope in scoped_after.json()["sections"].values()
    )
