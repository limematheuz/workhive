from app.core.security import create_access_token
from app.models.company import Company
from app.models.company_membership import Department, Team
from app.models.location import Location
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User
from app.services import company_entitlement_service, organization_bootstrap_service


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
        "Comercial",
        "Consulta",
        "Operaciones",
        "Finanzas",
        "Supervisor de zona",
    }


def test_all_organization_tab_reads_accept_get_requests(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "tab-reads")
    admin = _bootstrap_admin(db, company, "tab-reads-admin")
    headers = _headers(admin)

    for path in (
        "/api/v1/organization/members",
        "/api/v1/organization/departments",
        "/api/v1/organization/teams",
        "/api/v1/organization/permission-definitions",
        "/api/v1/organization/permission-profiles",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 200, response.text


def test_permission_catalog_explains_recommendations_and_reserved_permissions(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "permission-catalog")
    admin = _bootstrap_admin(db, company, "permission-catalog-admin")

    response = client.get(
        "/api/v1/organization/permission-definitions", headers=_headers(admin)
    )

    assert response.status_code == 200, response.text
    definitions = {definition["code"]: definition for definition in response.json()}
    assert definitions["access.members.manage"]["is_system_only"] is True
    assert definitions["access.members.manage"]["recommended_for"] == [
        "company_administrators"
    ]
    assert definitions["organization.teams.manage"]["is_system_only"] is False
    assert definitions["organization.teams.manage"]["recommended_for"] == [
        "operations",
        "responsibles",
    ]


def test_critical_permissions_cannot_be_delegated_through_custom_profiles(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "reserved-permissions")
    admin = _bootstrap_admin(db, company, "reserved-permissions-admin")
    headers = _headers(admin)

    for index, permission_code in enumerate(
        (
            "access.members.manage",
            "access.profiles.manage",
            "company.settings.manage",
        )
    ):
        response = client.post(
            "/api/v1/organization/permission-profiles",
            headers=headers,
            json={
                "name": f"Reserved {index}",
                "permission_codes": [permission_code],
            },
        )
        assert response.status_code == 409, response.text
        assert response.json()["detail"] == (
            "Selected permissions are reserved for company administrators"
        )

    custom_profile = client.post(
        "/api/v1/organization/permission-profiles",
        headers=headers,
        json={
            "name": "Operations viewer",
            "permission_codes": ["organization.teams.read"],
        },
    )
    assert custom_profile.status_code == 201, custom_profile.text
    update = client.patch(
        f"/api/v1/organization/permission-profiles/{custom_profile.json()['id']}",
        headers=headers,
        json={"permission_codes": ["access.profiles.manage"]},
    )
    assert update.status_code == 409, update.text


def test_default_profiles_are_editable_assignable_and_preserve_company_changes(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "editable-default-profiles")
    admin = _bootstrap_admin(db, company, "editable-default-profiles-admin")
    worker = _user(db, company, "editable-default-profiles-worker", role_id=3)
    worker_membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    assert worker_membership is not None
    db.commit()
    headers = _headers(admin)

    profiles_response = client.get(
        "/api/v1/organization/permission-profiles", headers=headers
    )
    assert profiles_response.status_code == 200, profiles_response.text
    profiles = {profile["name"]: profile for profile in profiles_response.json()}
    administrator = profiles["Administrador de empresa"]
    commercial = profiles["Comercial"]
    assert administrator["is_editable"] is False
    assert commercial["is_system"] is True
    assert commercial["is_editable"] is True

    update = client.patch(
        f"/api/v1/organization/permission-profiles/{commercial['id']}",
        headers=headers,
        json={
            "name": "Comercial",
            "description": "Gestiona la cartera de esta empresa",
            "permission_codes": ["clients.read"],
        },
    )
    assert update.status_code == 200, update.text
    assert update.json()["description"] == "Gestiona la cartera de esta empresa"
    assert update.json()["permission_codes"] == ["clients.read"]

    reserved_permission = client.patch(
        f"/api/v1/organization/permission-profiles/{commercial['id']}",
        headers=headers,
        json={"permission_codes": ["access.members.manage"]},
    )
    assert reserved_permission.status_code == 409, reserved_permission.text

    renamed = client.patch(
        f"/api/v1/organization/permission-profiles/{commercial['id']}",
        headers=headers,
        json={"name": "Ventas"},
    )
    assert renamed.status_code == 409, renamed.text

    protected = client.patch(
        f"/api/v1/organization/permission-profiles/{administrator['id']}",
        headers=headers,
        json={"description": "No se debe editar"},
    )
    assert protected.status_code == 409, protected.text

    assigned = client.put(
        f"/api/v1/organization/members/{worker_membership.id}/profile-assignments",
        headers=headers,
        json={
            "assignments": [
                {
                    "permission_profile_id": commercial["id"],
                    "scopes": [
                        {"scope_type": "company", "scope_id": company.id}
                    ],
                }
            ]
        },
    )
    assert assigned.status_code == 200, assigned.text
    assert [
        assignment["permission_profile_name"]
        for assignment in assigned.json()["profile_assignments"]
    ] == ["Comercial"]

    removed = client.put(
        f"/api/v1/organization/members/{worker_membership.id}/profile-assignments",
        headers=headers,
        json={"assignments": []},
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["profile_assignments"] == []

    organization_bootstrap_service.ensure_company_permission_profiles(db, company.id)
    db.commit()
    persisted = client.get(
        "/api/v1/organization/permission-profiles", headers=headers
    )
    assert persisted.status_code == 200, persisted.text
    persisted_commercial = next(
        profile for profile in persisted.json() if profile["name"] == "Comercial"
    )
    assert persisted_commercial["description"] == "Gestiona la cartera de esta empresa"
    assert persisted_commercial["permission_codes"] == ["clients.read"]


def test_legacy_custom_profile_cannot_authorize_critical_permissions(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "legacy-critical")
    admin = _bootstrap_admin(db, company, "legacy-critical-admin")
    worker = _user(db, company, "legacy-critical-worker", role_id=3)
    target = _user(db, company, "legacy-critical-target", role_id=3)
    worker_membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    target_membership = organization_bootstrap_service.ensure_user_membership(db, target)
    assert worker_membership is not None
    assert target_membership is not None

    definition = (
        db.query(PermissionDefinition)
        .filter(PermissionDefinition.code == "access.members.manage")
        .one()
    )
    legacy_profile = PermissionProfile(
        company_id=company.id,
        name="Legacy custom membership manager",
        is_system=False,
        is_active=True,
    )
    db.add(legacy_profile)
    db.flush()
    db.add(
        PermissionProfilePermission(
            permission_profile_id=legacy_profile.id,
            permission_definition_id=definition.id,
        )
    )
    assignment = MembershipPermissionProfileAssignment(
        company_id=company.id,
        company_membership_id=worker_membership.id,
        permission_profile_id=legacy_profile.id,
        assigned_by_user_id=admin.id,
        is_active=True,
    )
    db.add(assignment)
    db.flush()
    db.add(
        MembershipPermissionProfileScope(
            company_id=company.id,
            profile_assignment_id=assignment.id,
            scope_type="company",
            scope_id=company.id,
        )
    )
    db.commit()

    response = client.patch(
        f"/api/v1/organization/members/{target_membership.id}",
        headers=_headers(worker),
        json={"status": "suspended"},
    )

    assert response.status_code == 403, response.text


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


def test_promoting_member_rechecks_administrator_capacity(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "promotion-capacity")
    company.subscription_plan = "free"
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason="test.plan_changed",
    )
    admin = _bootstrap_admin(db, company, "promotion-capacity-admin")
    worker = _user(db, company, "promotion-capacity-worker", role_id=3)
    worker_membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    assert worker_membership is not None
    db.commit()

    response = client.patch(
        f"/api/v1/organization/members/{worker_membership.id}",
        headers=_headers(admin),
        json={"access_class": "admin"},
    )

    assert response.status_code == 409, response.text
    assert response.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
    db.refresh(worker_membership)
    db.refresh(worker)
    assert worker_membership.access_class == "worker"
    assert worker.role.name == "viewer"


def test_locations_are_kept_consistent_with_their_department_and_team(client, db):
    _seed_permission_definitions(db)
    company = _company(db, "location-organization")
    admin = _bootstrap_admin(db, company, "location-organization-admin")
    department = Department(
        company_id=company.id,
        name="Operaciones",
        normalized_name="operaciones",
        code="OPS",
        is_active=True,
    )
    other_department = Department(
        company_id=company.id,
        name="Comercial",
        normalized_name="comercial",
        code="COM",
        is_active=True,
    )
    db.add_all([department, other_department])
    db.flush()
    team = Team(
        company_id=company.id,
        department_id=department.id,
        name="Equipo Norte",
        code="NORTE",
        is_active=True,
    )
    location = Location(
        name="Local Norte",
        address="Calle Diez 10",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add_all([team, location])
    db.commit()
    headers = _headers(admin)

    external_company = _company(db, "external-location-organization")
    external_department = Department(
        company_id=external_company.id,
        name="Operaciones externas",
        normalized_name="operaciones externas",
        code="OPS-EXT",
        is_active=True,
    )
    db.add(external_department)
    db.flush()
    external_team = Team(
        company_id=external_company.id,
        department_id=external_department.id,
        name="Equipo externo",
        code="EXT",
        is_active=True,
    )
    db.add(external_team)
    db.commit()

    assigned = client.patch(
        f"/api/v1/locations/{location.id}",
        headers=headers,
        json={"team_id": team.id},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["department_id"] == department.id
    assert assigned.json()["team_id"] == team.id

    mismatch = client.patch(
        f"/api/v1/locations/{location.id}",
        headers=headers,
        json={"department_id": other_department.id, "team_id": team.id},
    )
    assert mismatch.status_code == 409, mismatch.text

    foreign_team = client.patch(
        f"/api/v1/locations/{location.id}",
        headers=headers,
        json={"team_id": external_team.id},
    )
    assert foreign_team.status_code == 404, foreign_team.text

    assert client.patch(
        f"/api/v1/organization/teams/{team.id}",
        headers=headers,
        json={"is_active": False},
    ).status_code == 409
    assert client.patch(
        f"/api/v1/organization/teams/{team.id}",
        headers=headers,
        json={"department_id": other_department.id},
    ).status_code == 409
    assert client.delete(
        f"/api/v1/organization/teams/{team.id}", headers=headers
    ).status_code == 409
    assert client.patch(
        f"/api/v1/organization/departments/{department.id}",
        headers=headers,
        json={"is_active": False},
    ).status_code == 409
    assert client.delete(
        f"/api/v1/organization/departments/{department.id}", headers=headers
    ).status_code == 409


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
