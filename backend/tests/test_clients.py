from credentials import TEST_SECRET, login_form, CREDENTIAL_FIELD


def _create_company_admin(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "clients-admin@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Clients Admin",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("clients-admin@workhive.com", TEST_SECRET),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Servicios de prueba",
            "tax_id": "B77777777",
            "address": "Calle Clientes 7",
            "phone": "600700700",
            "email": "admin@clientes.com",
        },
    )
    assert company.status_code == 201, company.text
    return headers


def test_client_contact_is_optional_and_status_filter_includes_inactive(client):
    headers = _create_company_admin(client)
    created = client.post(
        "/api/v1/clients/",
        headers=headers,
        json={
            "name": "Cliente sin contacto",
            "client_type": "individual",
            "email": None,
            "phone": None,
            "address": "Calle Particular 1",
            "city": "Girona",
            "postal_code": "17001",
            "country": "España",
            "legal_number": None,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["email"] is None
    assert created.json()["phone"] is None

    deleted = client.delete(
        f"/api/v1/clients/{created.json()['id']}",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text

    active = client.get("/api/v1/clients/?is_active=true", headers=headers)
    assert active.status_code == 200
    assert active.json() == []

    all_clients = client.get(
        "/api/v1/clients/?include_inactive=true",
        headers=headers,
    )
    assert all_clients.status_code == 200
    assert [item["id"] for item in all_clients.json()] == [created.json()["id"]]
    assert all_clients.json()[0]["is_active"] is False
