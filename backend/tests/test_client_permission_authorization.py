from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
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

    for path in (
        "/api/v1/clients/",
        f"/api/v1/clients/{account.id}/contacts",
        f"/api/v1/clients/{account.id}/opportunities",
    ):
        response = client.get(path, headers=unassigned_headers)
        assert response.status_code == 403, response.text


def test_client_permissions_do_not_cross_company_or_grant_platform_access(client, db):
    owner_company = _company(db, "owner")
    outsider_company = _company(db, "outsider")
    owner = _bootstrap_admin(db, owner_company, "owner-admin")
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
        "Consulta de clientes",
    }
    assert set(profiles["Comercial"]["permission_codes"]) == {
        CLIENT_READ,
        CLIENT_MANAGE,
        FOLLOW_UP_READ,
        FOLLOW_UP_MANAGE,
    }
    assert set(profiles["Consulta de clientes"]["permission_codes"]) == {
        CLIENT_READ,
        FOLLOW_UP_READ,
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
