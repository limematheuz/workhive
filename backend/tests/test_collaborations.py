from credentials import (
    TEST_SECRET,
    TEST_SECRET_A,
    TEST_SECRET_B,
    login_form,
    with_credential,
)
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User


def test_company_collaborations_flow(client):
    # 1. Register User A and create Company A
    client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "admina@workhive.com",
                "full_name": "Admin A",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_A,
        ),
    )
    login_a = client.post(
        "/api/v1/auth/login",
        data=login_form("admina@workhive.com", TEST_SECRET_A),
    )
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    client.post(
        "/api/v1/companies/",
        json={
            "name": "Company A Property Manager",
            "tax_id": "A11111111",
            "address": "Calle Gran Via 10",
            "phone": "600100200",
            "email": "admina@companya.com",
        },
        headers=headers_a,
    )

    # 2. Register User B and create Company B
    client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "adminb@workhive.com",
                "full_name": "Admin B",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_B,
        ),
    )
    login_b = client.post(
        "/api/v1/auth/login",
        data=login_form("adminb@workhive.com", TEST_SECRET_B),
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post(
        "/api/v1/companies/",
        json={
            "name": "Company B Cleaners",
            "tax_id": "B22222222",
            "address": "Calle Mayor 22",
            "phone": "600300400",
            "email": "adminb@companyb.com",
        },
        headers=headers_b,
    )

    # 3. Get Partner Code of Company B
    code_response_b = client.get("/api/v1/collaborations/code", headers=headers_b)
    assert code_response_b.status_code == 200
    code_b = code_response_b.json()["partner_code"]
    assert code_b.startswith("WH-COMP-")

    # 4. User A sends collaboration request to Company B
    req_response = client.post(
        "/api/v1/collaborations/requests",
        json={"partner_code": f"  {code_b.lower()}  ", "role_type": "service_provider"},
        headers=headers_a,
    )
    assert req_response.status_code == 201
    req_data = req_response.json()
    assert req_data["status"] == "pending"
    assert req_data["role_type"] == "service_provider"
    request_id = req_data["id"]

    # 5. User B lists received pending requests
    pending_response = client.get(
        "/api/v1/collaborations/requests/pending", headers=headers_b
    )
    assert pending_response.status_code == 200
    pending_list = pending_response.json()
    assert len(pending_list) == 1
    assert pending_list[0]["id"] == request_id

    # 6. User B accepts the collaboration request
    accept_response = client.post(
        f"/api/v1/collaborations/requests/{request_id}/accept",
        headers=headers_b,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"

    clients_a = client.get("/api/v1/clients/", headers=headers_a)
    clients_b = client.get("/api/v1/clients/", headers=headers_b)
    assert any(
        item["name"] == "Company B Cleaners"
        and item["client_type"] == "company"
        and item["email"] == "adminb@workhive.com"
        for item in clients_a.json()
    )
    assert any(
        item["name"] == "Company A Property Manager"
        and item["client_type"] == "company"
        and item["email"] == "admina@workhive.com"
        for item in clients_b.json()
    )

    # 7. User A lists active collaborations
    collabs_response = client.get("/api/v1/collaborations/", headers=headers_a)
    assert collabs_response.status_code == 200
    collabs_list = collabs_response.json()
    assert len(collabs_list) == 1
    assert collabs_list[0]["status"] == "accepted"
    assert collabs_list[0]["partner"]["email"] == "adminb@companyb.com"
    assert collabs_list[0]["partner"]["contact_email"] == "adminb@workhive.com"
    collab_id = collabs_list[0]["id"]

    collabs_response_b = client.get("/api/v1/collaborations/", headers=headers_b)
    assert collabs_response_b.status_code == 200
    assert len(collabs_response_b.json()) == 1

    providers_response_a = client.get(
        "/api/v1/collaborations/service-providers", headers=headers_a
    )
    providers_response_b = client.get(
        "/api/v1/collaborations/service-providers", headers=headers_b
    )
    assert providers_response_a.status_code == 200
    assert providers_response_b.status_code == 200
    assert [company["name"] for company in providers_response_a.json()] == [
        "Company B Cleaners"
    ]
    assert [company["name"] for company in providers_response_b.json()] == [
        "Company A Property Manager"
    ]

    # 8. User A unlinks the collaboration
    unlink_response = client.delete(
        f"/api/v1/collaborations/{collab_id}", headers=headers_a
    )
    assert unlink_response.status_code == 204

    # 9. Verify collaborations list is now empty
    collabs_response_after = client.get("/api/v1/collaborations/", headers=headers_a)
    assert len(collabs_response_after.json()) == 0


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
