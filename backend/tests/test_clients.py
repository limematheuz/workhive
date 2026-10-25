import pytest
from pydantic import ValidationError

from app.models.client import Client
from app.schemas.client import ClientCreate, ClientResponse
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


def test_client_writes_reject_blank_required_data_but_responses_allow_legacy_blanks():
    payload = {
        "name": "Cliente",
        "address": "Calle Uno",
        "city": " ",
        "postal_code": "17001",
        "country": "España",
    }

    with pytest.raises(ValidationError):
        ClientCreate.model_validate(payload)

    response = ClientResponse.model_validate(
        {
            **payload,
            "id": 1,
            "company_id": 1,
            "city": "",
            "postal_code": "",
        }
    )

    assert response.city == ""
    assert response.postal_code == ""


def test_legacy_email_remains_readable_without_allowing_new_invalid_addresses(client, db):
    headers = _create_company_admin(client)
    payload = {
        "name": "Cliente histórico",
        "address": "Calle Uno",
        "city": "Girona",
        "postal_code": "17001",
        "country": "España",
        "email": "valid@example.com",
    }
    created = client.post("/api/v1/clients/", headers=headers, json=payload)
    assert created.status_code == 201
    client_id = created.json()["id"]
    historical_email = "legacy@example.test"
    stored = db.get(Client, client_id)
    stored.email = historical_email
    db.commit()

    listing = client.get("/api/v1/clients/?include_inactive=true", headers=headers)
    assert listing.status_code == 200
    assert listing.json()[0]["email"] == historical_email
    detail = client.get(f"/api/v1/clients/{client_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["email"] == historical_email

    for invalid_email in [historical_email, "not-an-email"]:
        assert client.post(
            "/api/v1/clients/", headers=headers, json={**payload, "email": invalid_email}
        ).status_code == 422
        assert client.patch(
            f"/api/v1/clients/{client_id}", headers=headers, json={"email": invalid_email}
        ).status_code == 422
        assert client.post(
            f"/api/v1/clients/{client_id}/send-email",
            headers=headers,
            json={"recipient_emails": [invalid_email]},
        ).status_code == 422
    assert db.query(Client).count() == 1
    db.refresh(stored)
    assert stored.email == historical_email
