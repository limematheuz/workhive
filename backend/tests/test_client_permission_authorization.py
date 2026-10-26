from datetime import datetime, timezone

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
from app.models.company_membership import Department, Team
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User
from app.services import organization_bootstrap_service


CLIENT_READ = "clients.read"
CLIENT_MANAGE = "clients.manage"
FOLLOW_UP_READ = "commercial.follow_ups.read"
FOLLOW_UP_MANAGE = "commercial.follow_ups.manage"


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Client permission {suffix}",
        tax_id=f"CLIENT-PERM-{suffix}",
        address="Calle de prueba 1",
        phone="600000000",
        email=f"{suffix}@client-permissions.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    return company


def _user(db, company: Company | None, suffix: str, role_id: int) -> User:
    user = User(
        email=f"{suffix}@client-permissions.test",
        hashed_password="unused",
        full_name=suffix,
        role_id=role_id,
        company_id=company.id if company else None,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_admin(db, company: Company, suffix: str) -> User:
    admin = _user(db, company, suffix, role_id=1)
    organization_bootstrap_service.ensure_user_membership(db, admin)
    db.commit()
    return admin


def _client(db, company: Company, name: str) -> Client:
    client = Client(
        company_id=company.id,
        name=name,
        client_type="company",
        relationship_status="lead",
        address="Avenida Comercial 1",
        city="Madrid",
        postal_code="28001",
        country="España",
    )
    db.add(client)
    db.commit()
    return client


def _assign_company_profile(
    db,
    *,
    company: Company,
    admin: User,
    user: User,
    name: str,
    permission_codes: set[str],
    scope_type: str = "company",
    scope_id: int | None = None,
) -> None:
    membership = organization_bootstrap_service.ensure_user_membership(db, user)
    assert membership is not None
    definitions = (
        db.query(PermissionDefinition)
        .filter(PermissionDefinition.code.in_(permission_codes))
        .all()
    )
    assert {definition.code for definition in definitions} == permission_codes
    profile = PermissionProfile(
        company_id=company.id,
        name=name,
        description=name,
        is_system=False,
        is_active=True,
    )
    db.add(profile)
    db.flush()
    for definition in definitions:
        db.add(
            PermissionProfilePermission(
                permission_profile_id=profile.id,
                permission_definition_id=definition.id,
            )
        )
    assignment = MembershipPermissionProfileAssignment(
        company_id=company.id,
        company_membership_id=membership.id,
        permission_profile_id=profile.id,
        assigned_by_user_id=admin.id,
        is_active=True,
    )
    db.add(assignment)
    db.flush()
    db.add(
        MembershipPermissionProfileScope(
            company_id=company.id,
            profile_assignment_id=assignment.id,
            scope_type=scope_type,
            scope_id=scope_id if scope_id is not None else company.id,
        )
    )
    db.commit()


def test_client_and_commercial_permissions_are_separate_and_fail_closed(client, db):
    company = _company(db, "separation")
    admin = _bootstrap_admin(db, company, "admin")
    account = _client(db, company, "Cuenta protegida")
    commercial = _user(db, company, "commercial", role_id=3)
    reader = _user(db, company, "reader", role_id=3)
    unassigned = _user(db, company, "unassigned", role_id=3)
    narrow_scope = _user(db, company, "narrow-scope", role_id=3)
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=commercial,
        name="Comercial de prueba",
        permission_codes={CLIENT_READ, CLIENT_MANAGE, FOLLOW_UP_READ, FOLLOW_UP_MANAGE},
    )
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=reader,
        name="Consulta de prueba",
        permission_codes={CLIENT_READ, FOLLOW_UP_READ},
    )
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=narrow_scope,
        name="Alcance de equipo",
        permission_codes={CLIENT_READ, FOLLOW_UP_READ},
        scope_type="team",
        scope_id=1,
    )

    commercial_headers = _headers(commercial)
    reader_headers = _headers(reader)
    unassigned_headers = _headers(unassigned)

    assert client.get("/api/v1/clients/access", headers=commercial_headers).json() == {
        "can_read_clients": True,
        "can_manage_clients": True,
        "can_read_commercial_follow_ups": True,
        "can_manage_commercial_follow_ups": True,
    }
    assert client.get("/api/v1/clients/access", headers=reader_headers).json() == {
        "can_read_clients": True,
        "can_manage_clients": False,
        "can_read_commercial_follow_ups": True,
        "can_manage_commercial_follow_ups": False,
    }
    assert client.get("/api/v1/clients/access", headers=unassigned_headers).json() == {
        "can_read_clients": False,
        "can_manage_clients": False,
        "can_read_commercial_follow_ups": False,
        "can_manage_commercial_follow_ups": False,
    }
    assert client.get("/api/v1/clients/access", headers=_headers(narrow_scope)).json() == {
        "can_read_clients": False,
        "can_manage_clients": False,
        "can_read_commercial_follow_ups": False,
        "can_manage_commercial_follow_ups": False,
    }

    listed = client.get("/api/v1/clients/", headers=commercial_headers)
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [account.id]

    created_client = client.post(
        "/api/v1/clients/",
        headers=commercial_headers,
        json={
            "name": "Nueva cuenta comercial",
            "client_type": "company",
            "relationship_status": "lead",
            "address": "Calle de ventas 2",
            "city": "Madrid",
            "postal_code": "28002",
            "country": "España",
        },
    )
    assert created_client.status_code == 201, created_client.text

    contact = client.post(
        f"/api/v1/clients/{account.id}/contacts",
        headers=commercial_headers,
        json={"full_name": "Ana Compras", "roles": ["commercial"]},
    )
    assert contact.status_code == 201, contact.text

    follow_up = client.post(
        f"/api/v1/clients/{account.id}/opportunities",
        headers=commercial_headers,
        json={"title": "Visita de seguimiento"},
    )
    assert follow_up.status_code == 201, follow_up.text
    follow_up_id = follow_up.json()["id"]

    assert (
        client.get(
            f"/api/v1/clients/{account.id}/opportunity-owners",
            headers=commercial_headers,
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}/activities",
            headers=commercial_headers,
        ).status_code
        == 200
    )
    activity = client.post(
        f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}/activities",
        headers=commercial_headers,
        json={"activity_type": "note", "body": "Primera visita realizada"},
    )
    assert activity.status_code == 201, activity.text
    assert (
        client.patch(
            f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}",
            headers=commercial_headers,
            json={"stage": "qualified"},
        ).status_code
        == 200
    )

    history_path = f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}/activities"
    original_history = client.get(history_path, headers=commercial_headers)
    assert original_history.status_code == 200, original_history.text
    reader_history = client.get(history_path, headers=reader_headers)
    assert reader_history.status_code == 200, reader_history.text
    assert reader_history.json() == original_history.json()
    assert len(reader_history.json()) == 2
    assert any(item["body"] == "Primera visita realizada" for item in reader_history.json())
    original_follow_up = client.get(
        f"/api/v1/clients/{account.id}/opportunities", headers=commercial_headers
    ).json()

    assert client.get("/api/v1/clients/", headers=reader_headers).status_code == 200
    assert (
        client.get(
            f"/api/v1/clients/{account.id}/contacts", headers=reader_headers
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"/api/v1/clients/{account.id}/opportunities", headers=reader_headers
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/clients/{account.id}",
            headers=reader_headers,
            json={"name": "No permitido"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/clients/{account.id}/contacts",
            headers=reader_headers,
            json={"full_name": "No permitido"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/clients/{account.id}/opportunities",
            headers=reader_headers,
            json={"title": "No permitido"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/clients/{account.id}/opportunity-owners",
            headers=reader_headers,
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}",
            headers=reader_headers,
            json={"stage": "proposal"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/clients/{account.id}/opportunities/{follow_up_id}/activities",
            headers=reader_headers,
            json={"activity_type": "note", "body": "No permitido"},
        ).status_code
        == 403
    )

    after_denials = client.get(history_path, headers=reader_headers)
    assert after_denials.status_code == 200, after_denials.text
    assert after_denials.json() == original_history.json()
    assert client.get(
        f"/api/v1/clients/{account.id}/opportunities", headers=reader_headers
    ).json() == original_follow_up
    for denied_user in (unassigned, narrow_scope):
        denied_history = client.get(history_path, headers=_headers(denied_user))
        assert denied_history.status_code == 403, denied_history.text

    for path in (
        "/api/v1/clients/",
        f"/api/v1/clients/{account.id}/contacts",
        f"/api/v1/clients/{account.id}/opportunities",
    ):
        response = client.get(path, headers=unassigned_headers)
        assert response.status_code == 403, response.text


def test_me_exposes_finance_hints_from_the_explicit_profile(client, db):
    company = _company(db, "commercial-finance-hints")
    admin = _bootstrap_admin(db, company, "commercial-finance-admin")
    commercial = _user(db, company, "commercial-finance", role_id=3)
    commercial.email = "commercial-finance@permissions.example.com"
    db.commit()
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=commercial,
        name="Comercial sin finanzas",
        permission_codes={CLIENT_READ, CLIENT_MANAGE, FOLLOW_UP_READ, FOLLOW_UP_MANAGE},
    )

    response = client.get("/api/v1/users/me", headers=_headers(commercial))
    assert response.status_code == 200, response.text
    assert response.json()["can_view_finance"] is False
    assert response.json()["can_manage_finance"] is False
    invoices = client.get("/api/v1/invoices/", headers=_headers(commercial))
    assert invoices.status_code == 403, invoices.text


def test_client_permissions_do_not_cross_company_or_grant_platform_access(client, db):
    owner_company = _company(db, "owner")
    outsider_company = _company(db, "outsider")
    _bootstrap_admin(db, owner_company, "owner-admin")
    outsider_admin = _bootstrap_admin(db, outsider_company, "outsider-admin")
    account = _client(db, owner_company, "Cuenta de otra empresa")
    outsider = _user(db, outsider_company, "outsider-reader", role_id=3)
    _assign_company_profile(
        db,
        company=outsider_company,
        admin=outsider_admin,
        user=outsider,
        name="Lector externo",
        permission_codes={CLIENT_READ, FOLLOW_UP_READ},
    )

    foreign = client.get(
        f"/api/v1/clients/{account.id}", headers=_headers(outsider)
    )
    assert foreign.status_code == 404, foreign.text

    superadmin = _user(db, None, "platform-admin", role_id=4)
    db.commit()
    platform_response = client.get("/api/v1/clients/", headers=_headers(superadmin))
    assert platform_response.status_code == 403, platform_response.text


def test_location_permission_scope_filters_reads_and_fails_closed_for_writes(client, db):
    company = _company(db, "location-scope")
    admin = _bootstrap_admin(db, company, "location-scope-admin")
    allowed_location = Location(
        name="Centro autorizado",
        address="Calle Uno 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    blocked_location = Location(
        name="Centro bloqueado",
        address="Calle Dos 2",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add_all([allowed_location, blocked_location])
    db.commit()

    operator = _user(db, company, "location-scoped", role_id=3)
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=operator,
        name="Solo una ubicación",
        permission_codes={"locations.read"},
        scope_type="location",
        scope_id=allowed_location.id,
    )
    headers = _headers(operator)

    listed = client.get("/api/v1/locations/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [location["id"] for location in listed.json()] == [allowed_location.id]
    assert client.get(
        f"/api/v1/locations/{allowed_location.id}", headers=headers
    ).status_code == 200
    assert client.get(
        f"/api/v1/locations/{blocked_location.id}", headers=headers
    ).status_code == 403
    assert client.patch(
        f"/api/v1/locations/{allowed_location.id}",
        headers=headers,
        json={"name": "No permitido"},
    ).status_code == 403


def test_department_and_team_scopes_resolve_location_work_and_time(client, db):
    company = _company(db, "organization-scopes")
    admin = _bootstrap_admin(db, company, "organization-scopes-admin")
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
    db.add(team)
    db.flush()
    department_location = Location(
        name="Base de operaciones",
        address="Calle Siete 7",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
        department_id=department.id,
    )
    team_location = Location(
        name="Zona Norte",
        address="Calle Ocho 8",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
        department_id=department.id,
        team_id=team.id,
    )
    blocked_location = Location(
        name="Zona comercial",
        address="Calle Nueve 9",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
        department_id=other_department.id,
    )
    db.add_all([department_location, team_location, blocked_location])
    db.flush()
    department_task = TaskItem(
        title="Trabajo de operaciones",
        unit="servicio",
        company_id=company.id,
        location_id=department_location.id,
        status="pending",
    )
    team_task = TaskItem(
        title="Trabajo de zona norte",
        unit="servicio",
        company_id=company.id,
        location_id=team_location.id,
        status="pending",
    )
    blocked_task = TaskItem(
        title="Trabajo comercial",
        unit="servicio",
        company_id=company.id,
        location_id=blocked_location.id,
        status="pending",
    )
    department_operator = _user(db, company, "department-operator", role_id=3)
    team_operator = _user(db, company, "team-operator", role_id=3)
    db.add_all([department_task, team_task, blocked_task])
    db.flush()
    department_session = WorkSession(
        user_id=department_operator.id,
        location_id=department_location.id,
        start_time=datetime.now(timezone.utc),
    )
    blocked_session = WorkSession(
        user_id=department_operator.id,
        location_id=blocked_location.id,
        start_time=datetime.now(timezone.utc),
    )
    team_session = WorkSession(
        user_id=team_operator.id,
        location_id=team_location.id,
        start_time=datetime.now(timezone.utc),
    )
    db.add_all([department_session, blocked_session, team_session])
    db.commit()

    permission_codes = {"locations.read", "work.read", "time.manage"}
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=department_operator,
        name="Operaciones por departamento",
        permission_codes=permission_codes,
        scope_type="department",
        scope_id=department.id,
    )
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=team_operator,
        name="Operaciones por equipo",
        permission_codes=permission_codes,
        scope_type="team",
        scope_id=team.id,
    )

    department_headers = _headers(department_operator)
    team_headers = _headers(team_operator)

    department_locations = client.get("/api/v1/locations/", headers=department_headers)
    assert department_locations.status_code == 200, department_locations.text
    assert {item["id"] for item in department_locations.json()} == {
        department_location.id,
        team_location.id,
    }
    assert client.get(
        f"/api/v1/locations/{department_location.id}", headers=department_headers
    ).status_code == 200
    assert client.get(
        f"/api/v1/locations/{blocked_location.id}", headers=department_headers
    ).status_code == 403

    team_locations = client.get("/api/v1/locations/", headers=team_headers)
    assert team_locations.status_code == 200, team_locations.text
    assert [item["id"] for item in team_locations.json()] == [team_location.id]

    department_tasks = client.get("/api/v1/task-items/", headers=department_headers)
    assert department_tasks.status_code == 200, department_tasks.text
    assert {item["id"] for item in department_tasks.json()} == {
        department_task.id,
        team_task.id,
    }
    team_tasks = client.get("/api/v1/task-items/", headers=team_headers)
    assert team_tasks.status_code == 200, team_tasks.text
    assert [item["id"] for item in team_tasks.json()] == [team_task.id]
    assert client.get(
        f"/api/v1/task-items/{blocked_task.id}", headers=department_headers
    ).status_code == 403

    department_sessions = client.get(
        "/api/v1/work-sessions/", headers=department_headers
    )
    assert department_sessions.status_code == 200, department_sessions.text
    assert [item["id"] for item in department_sessions.json()] == [department_session.id]
    team_sessions = client.get("/api/v1/work-sessions/", headers=team_headers)
    assert team_sessions.status_code == 200, team_sessions.text
    assert [item["id"] for item in team_sessions.json()] == [team_session.id]


def test_work_permissions_are_limited_to_the_assigned_location_scope(client, db):
    company = _company(db, "work-scope")
    admin = _bootstrap_admin(db, company, "work-scope-admin")
    allowed_location = Location(
        name="Trabajo autorizado",
        address="Calle Tres 3",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    blocked_location = Location(
        name="Trabajo bloqueado",
        address="Calle Cuatro 4",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add_all([allowed_location, blocked_location])
    db.flush()
    allowed_task = TaskItem(
        title="Trabajo visible",
        unit="servicio",
        company_id=company.id,
        location_id=allowed_location.id,
        status="pending",
    )
    blocked_task = TaskItem(
        title="Trabajo oculto",
        unit="servicio",
        company_id=company.id,
        location_id=blocked_location.id,
        status="pending",
    )
    db.add_all([allowed_task, blocked_task])
    db.commit()

    operator = _user(db, company, "work-scoped", role_id=3)
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=operator,
        name="Operaciones de una ubicación",
        permission_codes={"work.read", "work.manage"},
        scope_type="location",
        scope_id=allowed_location.id,
    )
    headers = _headers(operator)

    listed = client.get("/api/v1/task-items/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [task["id"] for task in listed.json()] == [allowed_task.id]
    assert client.get(
        f"/api/v1/task-items/{allowed_task.id}", headers=headers
    ).status_code == 200
    assert client.get(
        f"/api/v1/task-items/{blocked_task.id}", headers=headers
    ).status_code == 403
    assert client.patch(
        f"/api/v1/task-items/{allowed_task.id}",
        headers=headers,
        json={"title": "Trabajo actualizado"},
    ).status_code == 200
    assert client.patch(
        f"/api/v1/task-items/{blocked_task.id}",
        headers=headers,
        json={"title": "No autorizado"},
    ).status_code == 403


def test_time_management_only_lists_sessions_at_the_assigned_locations(client, db):
    company = _company(db, "time-scope")
    admin = _bootstrap_admin(db, company, "time-scope-admin")
    allowed_location = Location(
        name="Fichaje autorizado",
        address="Calle Cinco 5",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    blocked_location = Location(
        name="Fichaje bloqueado",
        address="Calle Seis 6",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add_all([allowed_location, blocked_location])
    db.flush()

    operator = _user(db, company, "time-scoped", role_id=3)
    allowed_session = WorkSession(
        user_id=operator.id,
        location_id=allowed_location.id,
        start_time=datetime.now(timezone.utc),
        notes="Visible",
    )
    blocked_session = WorkSession(
        user_id=operator.id,
        location_id=blocked_location.id,
        start_time=datetime.now(timezone.utc),
        notes="Oculto",
    )
    db.add_all([allowed_session, blocked_session])
    db.commit()

    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=operator,
        name="Fichaje de una ubicación",
        permission_codes={"time.manage"},
        scope_type="location",
        scope_id=allowed_location.id,
    )
    headers = _headers(operator)

    listed = client.get("/api/v1/work-sessions/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [session["id"] for session in listed.json()] == [allowed_session.id]
    assert client.get(
        f"/api/v1/work-sessions/{allowed_session.id}", headers=headers
    ).status_code == 200
    assert client.get(
        f"/api/v1/work-sessions/{blocked_session.id}", headers=headers
    ).status_code == 404


def test_finance_reader_can_view_but_not_change_financial_records(client, db):
    company = _company(db, "finance-reader")
    admin = _bootstrap_admin(db, company, "finance-reader-admin")
    finance_reader = _user(db, company, "finance-reader", role_id=3)
    commercial_user = _user(db, company, "commercial-without-finance", role_id=2)
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=finance_reader,
        name="Lector financiero",
        permission_codes={"finance.read"},
    )
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=commercial_user,
        name="Solo comercial",
        permission_codes={CLIENT_READ, CLIENT_MANAGE, FOLLOW_UP_READ, FOLLOW_UP_MANAGE},
    )

    finance_headers = _headers(finance_reader)
    commercial_headers = _headers(commercial_user)
    assert client.get("/api/v1/quotes/", headers=finance_headers).status_code == 200
    assert client.get("/api/v1/expenses/", headers=finance_headers).status_code == 200
    assert client.post(
        "/api/v1/quotes/",
        headers=finance_headers,
        json={"title": "No puede crear"},
    ).status_code == 403
    assert client.get("/api/v1/quotes/", headers=commercial_headers).status_code == 403
    assert client.get("/api/v1/invoices/", headers=commercial_headers).status_code == 403


def test_new_company_has_safe_commercial_profile_templates(client, db):
    company = _company(db, "templates")
    admin = _bootstrap_admin(db, company, "templates-admin")

    response = client.get(
        "/api/v1/organization/permission-profiles", headers=_headers(admin)
    )
    assert response.status_code == 200, response.text
    profiles = {profile["name"]: profile for profile in response.json()}
    assert set(profiles) == {
        "Administrador de empresa",
        "Comercial",
        "Consulta",
        "Operaciones",
        "Finanzas",
    }
    assert set(profiles["Comercial"]["permission_codes"]) == {
        CLIENT_READ,
        CLIENT_MANAGE,
        FOLLOW_UP_READ,
        FOLLOW_UP_MANAGE,
    }
    assert set(profiles["Consulta"]["permission_codes"]) == {
        "locations.read",
        "work.read",
        "time.manage",
    }

    definitions = client.get(
        "/api/v1/organization/permission-definitions", headers=_headers(admin)
    )
    assert definitions.status_code == 200, definitions.text
    by_code = {item["code"]: item for item in definitions.json()}
    assert by_code[CLIENT_MANAGE]["recommended_for"] == [
        "commercial",
        "responsibles",
    ]
    assert by_code[FOLLOW_UP_MANAGE]["recommended_for"] == [
        "commercial",
        "responsibles",
    ]


def test_custom_profile_names_never_receive_system_privileges(db):
    company = _company(db, "reserved-names")
    custom_administrator = PermissionProfile(
        company_id=company.id,
        name="Administrador de empresa",
        description="Perfil creado por el cliente",
        is_system=False,
        is_active=True,
    )
    custom_commercial = PermissionProfile(
        company_id=company.id,
        name="Comercial",
        description="Perfil comercial creado por el cliente",
        is_system=False,
        is_active=True,
    )
    db.add_all([custom_administrator, custom_commercial])
    db.commit()

    try:
        organization_bootstrap_service.ensure_company_permission_profiles(db, company.id)
    except RuntimeError as error:
        assert "reserved administrator profile name" in str(error)
    else:
        raise AssertionError("A custom administrator profile name must fail closed")

    db.refresh(custom_administrator)
    db.refresh(custom_commercial)
    assert custom_administrator.is_system is False
    assert custom_commercial.is_system is False
    assert custom_administrator.permissions == []
    assert custom_commercial.permissions == []
