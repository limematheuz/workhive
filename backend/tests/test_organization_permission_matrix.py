import pytest
from pydantic import ValidationError

from app.schemas.organization import PermissionProfileUpdate, TeamUpdate, PermissionProfileCreate, TeamCreate
from app.services.organization_access_summary_service import ORGANIZATION_CAPABILITIES
from test_client_permission_authorization import _assign_company_profile
from test_organization_api import _bootstrap_admin, _company, _headers, _user


@pytest.mark.parametrize("resource,read,manage", [
    ("members", "access.members.read", "access.members.manage"),
    ("permission-profiles", "access.profiles.read", "access.profiles.manage"),
    ("departments", "organization.departments.read", "organization.departments.manage"),
    ("teams", "organization.teams.read", "organization.teams.manage"),
])
def test_each_tab_read_permission_does_not_allow_edits_or_other_tabs(client, db, resource, read, manage):
    company = _company(db, "tab-matrix")
    admin = _bootstrap_admin(db, company, "owner")
    reader = _user(db, company, "reader", 3)
    _assign_company_profile(db, company=company, admin=admin, user=reader, name="Read one tab", permission_codes={read})
    headers = _headers(reader)
    summary = client.get("/api/v1/organization/access", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json() == {code: code == read for code in ORGANIZATION_CAPABILITIES}
    for other in ("members", "permission-profiles", "departments", "teams"):
        assert client.get(f"/api/v1/organization/{other}", headers=headers).status_code == (200 if other == resource else 403)
    if resource == "members":
        response = client.patch("/api/v1/organization/members/1", headers=headers, json={"access_class": "admin"})
    else:
        response = client.post(f"/api/v1/organization/{resource}", headers=headers,
                               json={"name": "Not allowed", "permission_codes": [read]})
    assert response.status_code == 403, response.text
    assert summary.json()[manage] is False


def test_owner_can_manage_all_tabs_but_not_another_company(client, db):
    company = _company(db, "company-a")
    admin = _bootstrap_admin(db, company, "owner-a")
    other_company = _company(db, "company-b")
    other = _bootstrap_admin(db, other_company, "owner-b")
    assert all(client.get("/api/v1/organization/access", headers=_headers(admin)).json().values())
    for resource, payload in (
        ("departments", {"name": "Other department"}),
        ("teams", {"name": "Other team"}),
        ("permission-profiles", {"name": "Other profile", "permission_codes": ["work.read"]}),
    ):
        created = client.post(f"/api/v1/organization/{resource}", headers=_headers(other), json=payload)
        assert created.status_code == 201, created.text
        path = f"/api/v1/organization/{resource}/{created.json()['id']}"
        assert client.patch(path, headers=_headers(admin), json={"name": "Cross-tenant"}).status_code == 404
        assert client.delete(path, headers=_headers(admin)).status_code == 404
        assert all(item["id"] != created.json()["id"] for item in client.get(f"/api/v1/organization/{resource}", headers=_headers(admin)).json())


def test_department_cycles_and_foreign_team_members_are_rejected(client, db):
    company = _company(db, "structures")
    admin = _bootstrap_admin(db, company, "owner")
    headers = _headers(admin)
    root = client.post("/api/v1/organization/departments", headers=headers, json={"name": "Root"}).json()
    child = client.post("/api/v1/organization/departments", headers=headers, json={"name": "Child", "parent_department_id": root["id"]}).json()
    response = client.patch(f"/api/v1/organization/departments/{root['id']}", headers=headers, json={"parent_department_id": child["id"]})
    assert response.status_code == 409, response.text
    team = client.post("/api/v1/organization/teams", headers=headers, json={"name": "Team", "department_id": root["id"]}).json()
    other_company = _company(db, "foreign-roster")
    other = _bootstrap_admin(db, other_company, "foreign-owner")
    member_id = client.get("/api/v1/organization/members", headers=_headers(other)).json()[0]["id"]
    assert client.put(f"/api/v1/organization/teams/{team['id']}/members", headers=headers, json={"membership_ids": [member_id]}).status_code == 404
    own_team = client.get("/api/v1/organization/teams", headers=headers).json()[0]
    assert own_team["usage"]["active_member_assignments"] == 0


@pytest.mark.parametrize("schema,payload", [
    (PermissionProfileUpdate, {"name": None}), (PermissionProfileUpdate, {"name": "  "}),
    (PermissionProfileUpdate, {"is_active": None}), (TeamUpdate, {"name": None}),
    (TeamUpdate, {"name": "  "}), (TeamUpdate, {"is_active": None}),
    (PermissionProfileCreate, {"name": "  ", "permission_codes": ["work.read"]}),
    (TeamCreate, {"name": "  "}),
])
def test_required_profile_and_team_fields_do_not_reach_storage_as_null(schema, payload):
    with pytest.raises(ValidationError):
        schema.model_validate(payload)
