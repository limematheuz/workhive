import pytest

from app.models.company_membership import Department, Team
from app.models.location import Location
from app.services.organization_bootstrap_service import ensure_user_membership
from test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)


@pytest.mark.parametrize("scope", ["company", "department", "team", "location"])
def test_operational_hints_describe_explicit_scoped_access_instead_of_legacy_role(
    client, db, scope
):
    company = _company(db, "operational-hints")
    admin = _bootstrap_admin(db, company, "hints-admin")
    actor = _user(db, company, "hints-worker", 3)
    actor.email = "hints-worker@example.com"
    dept = Department(company_id=company.id, name="QA", normalized_name="qa", code="QA")
    db.add(dept)
    db.flush()
    team = Team(company_id=company.id, name="QA", code="QA", department_id=dept.id)
    db.add(team)
    db.flush()
    location = Location(
        name="QA",
        address="QA",
        city="QA",
        owner_company_id=company.id,
        managing_company_id=company.id,
        department_id=dept.id,
        team_id=team.id,
    )
    db.add(location)
    db.flush()
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=actor,
        name="QA operations",
        permission_codes={"work.read", "work.manage", "locations.read"},
        scope_type=scope,
        scope_id={
            "company": company.id,
            "department": dept.id,
            "team": team.id,
            "location": location.id,
        }[scope],
    )
    headers = _headers(actor)
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["can_manage_tasks"] is True
    assert response.json()["can_view_tasks"] is True
    assert response.json()["can_view_locations"] is True
    assert response.json()["can_manage_service_catalog"] is (scope == "company")
    created = client.post(
        "/api/v1/task-items/",
        headers=headers,
        json={
            "title": "QA explicit planning",
            "location_id": location.id,
            "unit": "service",
        },
    )
    assert created.status_code == 201, created.text


def test_an_explicitly_empty_manager_cannot_inherit_operational_ui_hints(client, db):
    company = _company(db, "empty-hints")
    _bootstrap_admin(db, company, "hints-owner")
    actor = _user(db, company, "hints-empty-manager", 2)
    actor.email = "hints-empty-manager@example.com"
    ensure_user_membership(db, actor).permissions_configured = True
    db.commit()
    response = client.get("/api/v1/users/me", headers=_headers(actor))
    assert response.status_code == 200, response.text
    for key in [
        "can_manage_tasks",
        "can_view_tasks",
        "can_view_locations",
        "can_manage_service_catalog",
    ]:
        assert response.json()[key] is False
