from credentials import TEST_SECRET, TEST_SECRET_A, login_form, with_credential
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User


def test_partner_code_collaboration_routes_are_not_available(client):
    email = "collaboration-admin@workhive.com"
    registration = client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": email,
                "full_name": "Collaboration admin",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_A,
        ),
    )
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET_A))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    assert client.get("/api/v1/collaborations/code", headers=headers).status_code == 404
    assert client.post(
        "/api/v1/collaborations/requests",
        headers=headers,
        json={"partner_code": "WH-OLD-123", "role_type": "service_provider"},
    ).status_code == 404


def test_company_contact_email_never_uses_superadmin(db):
    company = Company(
        name="Tester",
        tax_id="B12345678",
        address="Address",
        phone="123456789",
        email="fiscal@tester.com",
        is_active=True,
    )
    db.add(company)
    db.flush()
    db.add_all([
        User(
            email="mribeiro17.info@gmail.com",
            hashed_password=get_password_hash(TEST_SECRET),
            full_name="Platform Admin",
            role_id=4,
            company_id=company.id,
            is_active=True,
        ),
        User(
            email="tester@workhive.com",
            hashed_password=get_password_hash(TEST_SECRET),
            full_name="Tester Admin",
            role_id=1,
            company_id=company.id,
            is_active=True,
        ),
    ])
    db.commit()
    db.refresh(company)

    assert company.contact_email == "tester@workhive.com"
