from app.core.security import create_access_token
from app.models.company import Company
from app.models.permission_profile import PermissionDefinition
from app.models.user import User
from app.services import organization_bootstrap_service


PERMISSIONS = (
    "access.members.read",
    "access.members.manage",
    "access.profiles.read",
    "access.profiles.manage",
    "access.scopes.manage",
    "company.settings.manage",
    "organization.departments.read",
    "organization.departments.manage",
    "organization.teams.read",
    "organization.teams.manage",
)


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Organization {suffix}",
        tax_id=f"ORG-{suffix}",
        address="Calle de prueba 1",
        phone="600000000",
        email=f"{suffix}@organization.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    return company


def _user(db, company: Company, suffix: str, role_id: int) -> User:
    user = User(
        email=f"{suffix}@organization.test",
        hashed_password="unused",
        full_name=suffix,
        role_id=role_id,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _seed_permission_definitions(db) -> None:
    db.add_all(
        [
            PermissionDefinition(
                code=code,
                category="organization",
                description=code,
                is_active=True,
            )
            for code in PERMISSIONS
        ]
    )
    db.commit()


def _bootstrap_admin(db, company: Company, suffix: str) -> User:
    user = _user(db, company, suffix, role_id=1)
    organization_bootstrap_service.ensure_user_membership(db, user)
    db.commit()
    db.refresh(user)
    return user


def test_company_administrator_configures_departments_teams_and_profiles(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "admin")
    admin = _bootstrap_admin(db, company, "admin")
    headers = _headers(admin)

    department = client.post(
        "/api/v1/organization/departments",
        headers=headers,
        json={"name": "Operaciones", "code": "OPS"},
    )
    assert department.status_code == 201, department.text

    team = client.post(
        "/api/v1/organization/teams",
        headers=headers,
        json={"name": "Equipo Norte", "department_id": department.json()["id"]},
    )
    assert team.status_code == 201, team.text

    profile = client.post(
        "/api/v1/organization/permission-profiles",
        headers=headers,
        json={
            "name": "Supervisor de zona",
            "permission_codes": ["organization.teams.read"],
        },
    )
    assert profile.status_code == 201, profile.text
    assert profile.json()["permission_codes"] == ["organization.teams.read"]

    profiles = client.get("/api/v1/organization/permission-profiles", headers=headers)
    assert profiles.status_code == 200, profiles.text
    assert {item["name"] for item in profiles.json()} == {
        "Administrador de empresa",
        "Supervisor de zona",
    }


def test_profile_scopes_are_tenant_safe_and_do_not_grant_unrelated_company_access(
    client, db
):
    _seed_permission_definitions(db)
    company = _company(db, "tenant-a")
    other_company = _company(db, "tenant-b")
    admin = _bootstrap_admin(db, company, "tenant-admin")
    worker = _user(db, company, "tenant-worker", role_id=3)
    organization_bootstrap_service.ensure_user_membership(db, worker)
    other_admin = _bootstrap_admin(db, other_company, "tenant-other-admin")
    db.commit()
    headers = _headers(admin)

    department = client.post(
        "/api/v1/organization/departments",
        headers=headers,
        json={"name": "Operaciones"},
    )
    assert department.status_code == 201, department.text
    other_department = client.post(
        "/api/v1/organization/departments",
        headers=_headers(other_admin),
        json={"name": "Finanzas"},
    )
    assert other_department.status_code == 201, other_department.text

    profile = client.post(
        "/api/v1/organization/permission-profiles",
        headers=headers,
        json={
            "name": "Responsable de operaciones",
            "permission_codes": ["organization.departments.read"],
        },
    )
    assert profile.status_code == 201, profile.text

    members = client.get("/api/v1/organization/members", headers=headers)
    assert members.status_code == 200, members.text
    worker_membership_id = next(
        member["id"] for member in members.json() if member["user_id"] == worker.id
    )

    cross_company_scope = client.put(
        f"/api/v1/organization/members/{worker_membership_id}/profile-assignments",
        headers=headers,
        json={
            "assignments": [
                {
                    "permission_profile_id": profile.json()["id"],
                    "scopes": [
                        {
                            "scope_type": "department",
                            "scope_id": other_department.json()["id"],
                        }
                    ],
                }
            ]
        },
    )
    assert cross_company_scope.status_code == 409, cross_company_scope.text

    own_scope = client.put(
        f"/api/v1/organization/members/{worker_membership_id}/profile-assignments",
        headers=headers,
        json={
            "assignments": [
                {
                    "permission_profile_id": profile.json()["id"],
                    "scopes": [
                        {
                            "scope_type": "department",
                            "scope_id": department.json()["id"],
                        }
                    ],
                }
            ]
        },
    )
    assert own_scope.status_code == 200, own_scope.text

    worker_members = client.get(
        "/api/v1/organization/members", headers=_headers(worker)
    )
    assert worker_members.status_code == 403, worker_members.text


def test_company_never_loses_its_last_active_administrator(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "last-admin")
    admin = _bootstrap_admin(db, company, "last-admin")
    headers = _headers(admin)

    members = client.get("/api/v1/organization/members", headers=headers)
    assert members.status_code == 200, members.text
    membership_id = members.json()[0]["id"]

    response = client.patch(
        f"/api/v1/organization/members/{membership_id}",
        headers=headers,
        json={"status": "suspended"},
    )
    assert response.status_code == 409, response.text


def test_demoting_an_administrator_revokes_the_global_administrator_profile(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "demotion")
    first_admin = _bootstrap_admin(db, company, "demotion-first")
    second_admin = _bootstrap_admin(db, company, "demotion-second")
    headers = _headers(first_admin)

    members = client.get("/api/v1/organization/members", headers=headers)
    assert members.status_code == 200, members.text
    second_membership_id = next(
        member["id"]
        for member in members.json()
        if member["user_id"] == second_admin.id
    )

    response = client.patch(
        f"/api/v1/organization/members/{second_membership_id}",
        headers=headers,
        json={"access_class": "responsible"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_class"] == "responsible"
    assert response.json()["legacy_role_name"] == "manager"
    assert response.json()["profile_assignments"] == []


def test_department_names_are_unique_after_normalization(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "normalized-department")
    admin = _bootstrap_admin(db, company, "normalized-department-admin")
    headers = _headers(admin)

    first = client.post(
        "/api/v1/organization/departments",
        headers=headers,
        json={"name": "Operaciones"},
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        "/api/v1/organization/departments",
        headers=headers,
        json={"name": "  operáciones  "},
    )
    assert duplicate.status_code == 409, duplicate.text


def test_team_roster_controls_deactivation_and_keeps_membership_history(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "team-roster")
    admin = _bootstrap_admin(db, company, "team-roster-admin")
    worker = _user(db, company, "team-roster-worker", role_id=3)
    organization_bootstrap_service.ensure_user_membership(db, worker)
    db.commit()
    headers = _headers(admin)

    team = client.post(
        "/api/v1/organization/teams",
        headers=headers,
        json={"name": "Equipo de campo"},
    )
    assert team.status_code == 201, team.text

    members = client.get("/api/v1/organization/members", headers=headers)
    assert members.status_code == 200, members.text
    worker_membership_id = next(
        member["id"] for member in members.json() if member["user_id"] == worker.id
    )

    assign = client.put(
        f"/api/v1/organization/teams/{team.json()['id']}/members",
        headers=headers,
        json={"membership_ids": [worker_membership_id]},
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["usage"]["active_member_assignments"] == 1

    deactivate_while_assigned = client.patch(
        f"/api/v1/organization/teams/{team.json()['id']}",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivate_while_assigned.status_code == 409, deactivate_while_assigned.text

    clear_roster = client.put(
        f"/api/v1/organization/teams/{team.json()['id']}/members",
        headers=headers,
        json={"membership_ids": []},
    )
    assert clear_roster.status_code == 200, clear_roster.text

    deactivated = client.patch(
        f"/api/v1/organization/teams/{team.json()['id']}",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False
