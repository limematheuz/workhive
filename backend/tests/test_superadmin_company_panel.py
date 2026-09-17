from datetime import datetime, timezone

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.subscription_entitlement import CompanySubscription
from app.models.user import User
from credentials import TEST_SECRET, login_form, with_owner_credential


def _company(name: str, tax_id: str, email: str) -> Company:
    return Company(
        name=name,
        tax_id=tax_id,
        address=f"Address {name}",
        phone="600000000",
        email=email,
        is_active=True,
        subscription_plan="pro",
        subscription_status="active",
    )


def _headers(client, email: str) -> dict[str, str]:
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email, TEST_SECRET),
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_company_panel_uses_company_admin_contact_and_hides_legacy_superadmin(
    client,
    db,
):
    platform_email = "mribeiro17.info@gmail.com"
    company = _company("Tester", "B12345678", platform_email)
    company_without_admin = _company("No Admin", "B12345679", platform_email)
    db.add_all([company, company_without_admin])
    db.flush()
    platform_admin = User(
        email=platform_email,
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="WorkHive Administrator",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    legacy_company_superadmin = User(
        email="legacy-superadmin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Legacy Superadmin",
        role_id=4,
        company_id=company.id,
        is_active=True,
    )
    legacy_only_superadmin = User(
        email="legacy-only-superadmin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Legacy Only Superadmin",
        role_id=4,
        company_id=company_without_admin.id,
        is_active=True,
    )
    company_admin = User(
        email="tester@workhive.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Tester",
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add_all(
        [
            platform_admin,
            legacy_company_superadmin,
            legacy_only_superadmin,
            company_admin,
        ]
    )
    db.commit()

    headers = _headers(client, platform_email)
    companies_response = client.get("/api/v1/companies/", headers=headers)
    members_response = client.get(
        f"/api/v1/companies/{company.id}/members",
        headers=headers,
    )

    assert companies_response.status_code == 200
    companies_by_id = {item["id"]: item for item in companies_response.json()}
    company_payload = companies_by_id[company.id]
    assert company_payload["email"] == platform_email
    assert company_payload["contact_email"] == "tester@workhive.com"
    assert "hashed_password" not in company_payload
    assert companies_by_id[company_without_admin.id]["contact_email"] is None

    assert members_response.status_code == 200
    assert [member["email"] for member in members_response.json()] == [
        "tester@workhive.com"
    ]
    assert all("hashed_password" not in member for member in members_response.json())


def test_company_scoped_superadmin_cannot_use_platform_company_panel(
    client,
    db,
):
    own_company = _company("Own", "B10000001", "own@example.com")
    other_company = _company("Other", "B10000002", "other@example.com")
    db.add_all([own_company, other_company])
    db.flush()
    scoped_superadmin = User(
        email="scoped-superadmin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Scoped Superadmin",
        role_id=4,
        company_id=own_company.id,
        is_active=True,
    )
    db.add(scoped_superadmin)
    db.commit()

    headers = _headers(client, scoped_superadmin.email)

    company_list = client.get("/api/v1/companies/", headers=headers)
    assert company_list.status_code == 200
    assert [company["id"] for company in company_list.json()] == [own_company.id]

    assert (
        client.get(f"/api/v1/companies/{other_company.id}", headers=headers).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/companies/{own_company.id}/members", headers=headers
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/companies/{own_company.id}",
            headers=headers,
            json={"subscription_plan": "none"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/v1/companies/{other_company.id}", headers=headers
        ).status_code
        == 403
    )
    assert client.get("/api/v1/trial-requests/", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/v1/roles/",
            headers=headers,
            json={"name": "unsafe-global-role", "description": "Must be rejected"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/companies/provision",
            headers=headers,
            json=with_owner_credential(
                {
                    "name": "Forbidden",
                    "tax_id": "B10000003",
                    "address": "Forbidden address",
                    "phone": "600000003",
                    "email": "forbidden@example.com",
                    "owner_full_name": "Forbidden Owner",
                    "owner_email": "forbidden-owner@example.com",
                }
            ),
        ).status_code
        == 403
    )


def test_platform_provisioned_paid_company_records_commercial_terms(client, db):
    platform = User(
        email="commercial-provision-superadmin@workhive.test",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Commercial provision superadmin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(platform)
    db.commit()

    response = client.post(
        "/api/v1/companies/provision",
        headers=_headers(client, platform.email),
        json=with_owner_credential(
            {
                "name": "Contracted company",
                "tax_id": "B10000004",
                "address": "Contract street 1",
                "phone": "600000004",
                "email": "contracted-company@example.com",
                "owner_full_name": "Contracted owner",
                "owner_email": "contracted-owner@example.com",
                "subscription_plan": "medium",
                "commercial_terms": {
                    "billing_interval": "annual",
                    "amount_cents": 60000,
                    "currency": "EUR",
                    "tax_behavior": "exclusive",
                    "effective_at": datetime.now(timezone.utc).isoformat(),
                },
            }
        ),
    )

    assert response.status_code == 201, response.text
    subscription = (
        db.query(CompanySubscription)
        .filter(
            CompanySubscription.company_id == response.json()["id"],
            CompanySubscription.ended_at.is_(None),
        )
        .one()
    )
    assert subscription.commercial_billing_interval == "annual"
    assert subscription.commercial_amount_cents == 60000
