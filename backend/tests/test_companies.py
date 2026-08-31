from datetime import datetime, timedelta, timezone

from credentials import (
    TEST_SUPER,
    TEST_TEMP,
    login_form,
    with_credential,
    with_owner_credential,
)
from app.core.security import get_password_hash
from app.models.privacy_consent import PrivacyConsent
from app.models.trial_request import TrialRequest
from app.models.user import User


def test_create_company_promotes_user(client):
    client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "test@workhive.com",
                "full_name": "Test User",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            }
        ),
    )
    response = client.post(
        "/api/v1/auth/login",
        data=login_form("test@workhive.com"),
    )
    data = response.json()
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert "access_token" in data

    response_company = client.post(
        "/api/v1/companies/",
        json={
            "name": "Limpiezas García SL",
            "tax_id": "B87654321",
            "address": "Calle Mayor 1, Madrid",
            "phone": "666111222",
            "email": "info@garcia.com",
        },
        headers=headers,
    )

    assert response_company.status_code == 201
    company_id = response_company.json()["id"]

    response_user = client.get(
        "/api/v1/users/me",
        headers=headers,
    )
    user_data = response_user.json()
    assert user_data["role_id"] == 1
    assert user_data["company_id"] == company_id


def test_superadmin_can_provision_company_and_owner(client, db):
    superadmin = User(
        email="superadmin@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="WorkHive Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()

    login_response = client.post(
        "/api/v1/auth/login",
        data=login_form("superadmin@workhive.com", TEST_SUPER),
    )
    token = login_response.json()["access_token"]
    response = client.post(
        "/api/v1/companies/provision",
        headers={"Authorization": f"Bearer {token}"},
        json=with_owner_credential(
            {
                "name": "Limpiezas Costa",
                "tax_id": "B12340000",
                "address": "Calle Mar 10",
                "phone": "600000001",
                "email": "contacto@limpiezascosta.com",
                "owner_full_name": "Ana Costa",
                "owner_email": "ana@limpiezascosta.com",
            }
        ),
    )

    assert response.status_code == 201
    assert response.json()["subscription_plan"] == "top"
    assert response.json()["subscription_status"] == "trialing"
    company_id = response.json()["id"]
    owner_login = client.post(
        "/api/v1/auth/login",
        data=login_form("ana@limpiezascosta.com", TEST_TEMP),
    )
    owner_token = owner_login.json()["access_token"]
    owner_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_response.status_code == 200
    assert owner_response.json()["company_id"] == company_id
    assert owner_response.json()["role"]["name"] == "admin"

    deactivate_response = client.patch(
        f"/api/v1/companies/{company_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"is_active": False},
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

    blocked_owner = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert blocked_owner.status_code == 401

    companies_response = client.get(
        "/api/v1/companies/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert int(companies_response.headers["X-Total-Count"]) >= 1
    assert any(
        company["id"] == company_id and company["is_active"] is False
        for company in companies_response.json()
    )


def test_superadmin_can_provision_an_enterprise_plan(client, db):
    superadmin = User(
        email="superadmin-enterprise@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="WorkHive Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(superadmin.email, TEST_SUPER),
    )

    response = client.post(
        "/api/v1/companies/provision",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        json=with_owner_credential(
            {
                "name": "Enterprise Cleaning",
                "tax_id": "B12340001",
                "address": "Enterprise Avenue 1",
                "phone": "600000002",
                "email": "office@enterprise-cleaning.com",
                "owner_full_name": "Enterprise Owner",
                "owner_email": "owner@enterprise-cleaning.com",
                "subscription_plan": "mega",
                "trial_days": None,
            }
        ),
    )

    assert response.status_code == 201
    assert response.json()["subscription_plan"] == "mega"
    assert response.json()["subscription_status"] == "active"


def test_superadmin_can_revoke_subscription_access_and_sessions(client, db):
    superadmin = User(
        email="superadmin-subscription@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="WorkHive Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()

    super_login = client.post(
        "/api/v1/auth/login",
        data=login_form("superadmin-subscription@workhive.com", TEST_SUPER),
    )
    super_headers = {"Authorization": f"Bearer {super_login.json()['access_token']}"}
    provision = client.post(
        "/api/v1/companies/provision",
        headers=super_headers,
        json=with_owner_credential(
            {
                "name": "Trial Cancelled",
                "tax_id": "B12340099",
                "address": "Calle Cancel 10",
                "phone": "600000099",
                "email": "contacto@cancelled.com",
                "owner_full_name": "Cancelled Admin",
                "owner_email": "admin@cancelled.com",
            }
        ),
    )
    assert provision.status_code == 201
    company_id = provision.json()["id"]

    owner_login = client.post(
        "/api/v1/auth/login",
        data=login_form("admin@cancelled.com", TEST_TEMP),
    )
    assert owner_login.status_code == 200
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}

    revoke = client.patch(
        f"/api/v1/companies/{company_id}",
        headers=super_headers,
        json={"subscription_plan": "none", "subscription_status": "inactive"},
    )
    assert revoke.status_code == 200
    assert revoke.json()["subscription_plan"] == "none"
    assert revoke.json()["subscription_status"] == "inactive"

    old_session = client.get("/api/v1/users/me", headers=owner_headers)
    assert old_session.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        data=login_form("admin@cancelled.com", TEST_TEMP),
    )
    assert new_login.status_code == 200
    new_owner_headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}
    blocked_operational_access = client.get("/api/v1/users/me", headers=new_owner_headers)
    assert blocked_operational_access.status_code == 402


def test_only_superadmin_can_list_all_company_members(client, db):
    superadmin = User(
        email="superadmin-members@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="Platform Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    super_login = client.post(
        "/api/v1/auth/login",
        data=login_form(superadmin.email, TEST_SUPER),
    )
    super_headers = {"Authorization": f"Bearer {super_login.json()['access_token']}"}
    provision = client.post(
        "/api/v1/companies/provision",
        headers=super_headers,
        json=with_owner_credential(
            {
                "name": "Members Company",
                "tax_id": "B12340111",
                "address": "Calle Equipo 1",
                "phone": "600000111",
                "email": "company-members@example.com",
                "owner_full_name": "Company Admin",
                "owner_email": "company-admin@example.com",
            }
        ),
    )
    company_id = provision.json()["id"]
    db.add_all(
        [
            User(
                email="manager-members@example.com",
                hashed_password=get_password_hash(TEST_TEMP),
                full_name="Manager Member",
                role_id=2,
                company_id=company_id,
                is_active=True,
            ),
            User(
                email="worker-members@example.com",
                hashed_password=get_password_hash(TEST_TEMP),
                full_name="Inactive Worker",
                role_id=3,
                company_id=company_id,
                is_active=False,
            ),
            User(
                email="deleted+members@invalid.workhive.local",
                hashed_password=get_password_hash(TEST_TEMP),
                full_name="Deleted user",
                role_id=3,
                company_id=company_id,
                is_active=False,
            ),
        ]
    )
    db.commit()

    response = client.get(
        f"/api/v1/companies/{company_id}/members",
        headers=super_headers,
    )

    assert response.status_code == 200
    assert {(member["role"], member["is_active"]) for member in response.json()} == {
        ("admin", True),
        ("manager", True),
        ("viewer", False),
    }
    assert all("invalid.workhive.local" not in member["email"] for member in response.json())
    assert all("hashed_password" not in member for member in response.json())

    owner_login = client.post(
        "/api/v1/auth/login",
        data=login_form("company-admin@example.com", TEST_TEMP),
    )
    forbidden = client.get(
        f"/api/v1/companies/{company_id}/members",
        headers={"Authorization": f"Bearer {owner_login.json()['access_token']}"},
    )
    assert forbidden.status_code == 403


def test_superadmin_can_permanently_delete_empty_trial_company_and_owner_email(
    client, db
):
    superadmin = User(
        email="superadmin-delete@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="WorkHive Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()

    super_login = client.post(
        "/api/v1/auth/login",
        data=login_form("superadmin-delete@workhive.com", TEST_SUPER),
    )
    super_headers = {"Authorization": f"Bearer {super_login.json()['access_token']}"}
    provision = client.post(
        "/api/v1/companies/provision",
        headers=super_headers,
        json=with_owner_credential(
            {
                "name": "Empty Trial",
                "tax_id": "B77770099",
                "address": "Calle Empty 10",
                "phone": "600000077",
                "email": "contacto@emptytrial.com",
                "owner_full_name": "Empty Admin",
                "owner_email": "owner@emptytrial.com",
            }
        ),
    )
    assert provision.status_code == 201
    company_id = provision.json()["id"]
    owner = db.query(User).filter(User.email == "owner@emptytrial.com").one()
    db.add(
        PrivacyConsent(
            user_id=owner.id,
            company_id=company_id,
            consent_type="privacy_policy",
            policy_version="2026-06-15",
            accepted=True,
        )
    )
    db.add(
        TrialRequest(
            full_name="Empty Admin",
            email="owner@emptytrial.com",
            company_name="Empty Trial",
            status="approved",
            verification_token_hash="delete-company-trial-token",
            verification_token_expires_at=datetime.now(timezone.utc)
            + timedelta(hours=1),
            approved_by_user_id=superadmin.id,
            created_company_id=company_id,
            created_user_id=owner.id,
        )
    )
    db.commit()

    delete_response = client.delete(
        f"/api/v1/companies/{company_id}",
        headers=super_headers,
    )

    assert delete_response.status_code == 204
    assert db.query(User).filter(User.email == "owner@emptytrial.com").first() is None
    blocked_login = client.post(
        "/api/v1/auth/login",
        data=login_form("owner@emptytrial.com", TEST_TEMP),
    )
    assert blocked_login.status_code == 401


def test_company_document_defaults_are_editable(client):
    client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "defaults@workhive.com",
                "full_name": "Defaults Admin",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            }
        ),
    )
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("defaults@workhive.com"),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Defaults SL",
            "tax_id": "B44550011",
            "address": "Calle Defaults 1",
            "phone": "600000001",
            "email": "billing@defaults.com",
        },
    )
    company_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/companies/{company_id}",
        headers=headers,
        json={
            "default_payment_notes": "Transferencia a 30 días",
            "default_document_terms": "Validez de 15 días",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["default_payment_notes"] == "Transferencia a 30 días"
    assert updated.json()["default_document_terms"] == "Validez de 15 días"


def test_company_swift_bic_is_normalized_and_rejects_invalid_values(client):
    client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "banking@workhive.com",
                "full_name": "Banking Admin",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            }
        ),
    )
    login = client.post("/api/v1/auth/login", data=login_form("banking@workhive.com"))
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Banking SL",
            "tax_id": "B44550022",
            "address": "Calle Bancaria 1",
            "phone": "600000002",
            "email": "billing@banking.com",
        },
    )
    company_id = company.json()["id"]

    updated = client.patch(
        f"/api/v1/companies/{company_id}",
        headers=headers,
        json={"swift_bic": " caixes bb xxx "},
    )
    assert updated.status_code == 200
    assert updated.json()["swift_bic"] == "CAIXESBBXXX"

    invalid = client.patch(
        f"/api/v1/companies/{company_id}",
        headers=headers,
        json={"swift_bic": "12345678"},
    )
    assert invalid.status_code == 422
