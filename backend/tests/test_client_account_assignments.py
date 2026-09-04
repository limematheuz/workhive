from app.core.security import create_access_token, get_password_hash
from app.models.client_account_assignment import ClientAccountAssignment
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionProfile,
)
from app.models.user import User
from app.services import organization_bootstrap_service
from app.services.organization_base_profile_service import COMMERCIAL_PROFILE_NAME
from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _admin_headers(client, suffix: str) -> tuple[dict[str, str], int]:
    email = f"portfolio-admin-{suffix}@workhive.com"
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": f"Portfolio admin {suffix}",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registered.status_code == 201, registered.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Portfolio company {suffix}",
            "tax_id": f"PORTFOLIO-{suffix}",
            "address": "Calle Comercial 5",
            "phone": "600001300",
            "email": f"portfolio-{suffix}@workhive.com",
        },
    )
    assert company.status_code == 201, company.text
    return headers, company.json()["id"]


def _client_payload(name: str) -> dict[str, object]:
    return {
        "name": name,
        "client_type": "company",
        "relationship_status": "lead",
        "address": "Avenida Comercial 3",
        "city": "Madrid",
        "postal_code": "28003",
        "country": "España",
    }


def _add_member(db, *, company_id: int, email: str, role_id: int = 3) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash(TEST_SECRET),
        full_name=email.split("@", maxsplit=1)[0],
        role_id=role_id,
        company_id=company_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    membership = organization_bootstrap_service.ensure_user_membership(db, user)
    assert membership is not None
    db.commit()
    return user


def _grant_commercial_owner(db, *, company_id: int, user: User, assigned_by: User) -> None:
    membership = (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user.id,
        )
        .one()
    )
    profile = (
        db.query(PermissionProfile)
        .filter(
            PermissionProfile.company_id == company_id,
            PermissionProfile.name == COMMERCIAL_PROFILE_NAME,
            PermissionProfile.is_active.is_(True),
        )
        .one()
    )
    assignment = MembershipPermissionProfileAssignment(
        company_id=company_id,
        company_membership_id=membership.id,
        permission_profile_id=profile.id,
        assigned_by_user_id=assigned_by.id,
        is_active=True,
    )
    db.add(assignment)
    db.flush()
    db.add(
        MembershipPermissionProfileScope(
            company_id=company_id,
            profile_assignment_id=assignment.id,
            scope_type="company",
            scope_id=company_id,
        )
    )
    db.commit()


def test_client_account_assignment_keeps_history_and_exposes_current_portfolio(client, db):
    headers, company_id = _admin_headers(client, "history")
    created_client = client.post(
        "/api/v1/clients/",
        headers=headers,
        json=_client_payload("Cartera comercial"),
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]
    admin = (
        db.query(User)
        .filter(User.email == "portfolio-admin-history@workhive.com")
        .one()
    )
    admin_membership = (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == admin.id,
        )
        .one()
    )
    second_owner = _add_member(
        db,
        company_id=company_id,
        email="portfolio-owner-history@workhive.com",
    )
    _grant_commercial_owner(
        db,
        company_id=company_id,
        user=second_owner,
        assigned_by=admin,
    )
    second_membership = (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == second_owner.id,
        )
        .one()
    )

    assert (
        client.get(
            f"/api/v1/clients/{client_id}/account-assignment",
            headers=headers,
        ).status_code
        == 404
    )

    candidates = client.get(
        f"/api/v1/clients/{client_id}/account-assignment/candidates",
        headers=headers,
    )
    assert candidates.status_code == 200, candidates.text
    candidate_by_membership = {
        item["membership_id"]: item for item in candidates.json()
    }
    assert set(candidate_by_membership) == {
        admin_membership.id,
        second_membership.id,
    }
    assert candidate_by_membership[admin_membership.id] == {
        "membership_id": admin_membership.id,
        "full_name": admin.full_name,
        "email": admin.email,
        "profile_names": ["Administrador de empresa"],
    }
    assert candidate_by_membership[second_membership.id] == {
        "membership_id": second_membership.id,
        "full_name": second_owner.full_name,
        "email": second_owner.email,
        "profile_names": [COMMERCIAL_PROFILE_NAME],
    }

    assigned_to_admin = client.put(
        f"/api/v1/clients/{client_id}/account-assignment",
        headers=headers,
        json={"membership_id": admin_membership.id},
    )
    assert assigned_to_admin.status_code == 200, assigned_to_admin.text
    assert assigned_to_admin.json()["membership_id"] == admin_membership.id
    assert assigned_to_admin.json()["assigned_by_user_id"] == admin.id

    listed_clients = client.get("/api/v1/clients/", headers=headers)
    assert listed_clients.status_code == 200, listed_clients.text
    assert listed_clients.json()[0]["account_assignment"]["membership_id"] == admin_membership.id

    portfolio = client.get("/api/v1/clients/portfolio", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    assert [item["client"]["id"] for item in portfolio.json()] == [client_id]
    assert portfolio.json()[0]["assignment"]["membership_id"] == admin_membership.id

    reassigned = client.put(
        f"/api/v1/clients/{client_id}/account-assignment",
        headers=headers,
        json={"membership_id": second_membership.id},
    )
    assert reassigned.status_code == 200, reassigned.text
    assert reassigned.json()["membership_id"] == second_membership.id
    assert client.get("/api/v1/clients/portfolio", headers=headers).json() == []

    assignments = (
        db.query(ClientAccountAssignment)
        .filter(ClientAccountAssignment.client_id == client_id)
        .order_by(ClientAccountAssignment.id.asc())
        .all()
    )
    assert [assignment.company_membership_id for assignment in assignments] == [
        admin_membership.id,
        second_membership.id,
    ]
    assert assignments[0].ended_at is not None
    assert assignments[1].ended_at is None

    cleared = client.put(
        f"/api/v1/clients/{client_id}/account-assignment",
        headers=headers,
        json={"membership_id": None},
    )
    assert cleared.status_code == 204
    assert (
        client.get(
            f"/api/v1/clients/{client_id}/account-assignment",
            headers=headers,
        ).status_code
        == 404
    )
    assert all(assignment.ended_at is not None for assignment in assignments)


def test_client_account_assignment_rejects_untrusted_members_and_read_only_users(client, db):
    headers, company_id = _admin_headers(client, "boundaries")
    created_client = client.post(
        "/api/v1/clients/",
        headers=headers,
        json=_client_payload("Cuenta protegida"),
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    viewer = _add_member(
        db,
        company_id=company_id,
        email="portfolio-viewer-boundaries@workhive.com",
    )
    viewer_membership = (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == viewer.id,
        )
        .one()
    )
    viewer_headers = {
        "Authorization": f"Bearer {create_access_token({'sub': viewer.email, 'ver': viewer.session_version})}"
    }
    assert (
        client.get(
            f"/api/v1/clients/{client_id}/account-assignment",
            headers=viewer_headers,
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/v1/clients/{client_id}/account-assignment",
            headers=viewer_headers,
            json={"membership_id": None},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/clients/{client_id}/account-assignment/candidates",
            headers=viewer_headers,
        ).status_code
        == 403
    )
    ineligible_assignment = client.put(
        f"/api/v1/clients/{client_id}/account-assignment",
        headers=headers,
        json={"membership_id": viewer_membership.id},
    )
    assert ineligible_assignment.status_code == 422
    assert "commercial owner" in ineligible_assignment.json()["detail"]

    foreign_company = Company(
        name="Foreign portfolio company",
        tax_id="PORTFOLIO-FOREIGN",
        address="Calle Ajena 1",
        phone="600001301",
        email="foreign-portfolio@workhive.com",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(foreign_company)
    db.flush()
    foreign_member = _add_member(
        db,
        company_id=foreign_company.id,
        email="portfolio-foreign-member@workhive.com",
    )
    foreign_membership = (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == foreign_company.id,
            CompanyMembership.user_id == foreign_member.id,
        )
        .one()
    )

    foreign_assignment = client.put(
        f"/api/v1/clients/{client_id}/account-assignment",
        headers=headers,
        json={"membership_id": foreign_membership.id},
    )
    assert foreign_assignment.status_code == 422
    assert "commercial owner" in foreign_assignment.json()["detail"]
