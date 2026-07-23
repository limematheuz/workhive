import pytest
from pydantic import ValidationError

from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.quote import QuoteCreate, QuoteUpdate
from app.schemas.quote_item import QuoteItemCreate, QuoteItemUpdate
from app.schemas.reservation import ReservationCreate
from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _authenticated_company(client, *, email: str, company_name: str, tax_id: str):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": company_name,
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    token = client.post(
        "/api/v1/auth/login",
        data=login_form(email, TEST_SECRET),
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/companies/",
        json={
            "name": company_name,
            "tax_id": tax_id,
            "address": "Calle Principal 1",
            "phone": "+34600111222",
            "email": email,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return headers


def _unregistered_quote(client, headers):
    response = client.post(
        "/api/v1/quotes/",
        json={
            "title": "Limpieza mensual",
            "custom_recipient_info": (
                "Cliente Nuevo\nNIF: B12345679\n"
                "Dirección: Calle Cliente 2\n"
                "Tel: +34600999888\nEmail: cliente@example.com"
            ),
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_accept_quote_and_register_client_is_one_tenant_scoped_operation(client):
    owner_headers = _authenticated_company(
        client,
        email="quotes-owner@example.com",
        company_name="Quotes Owner",
        tax_id="B10000001",
    )
    outsider_headers = _authenticated_company(
        client,
        email="quotes-outsider@example.com",
        company_name="Quotes Outsider",
        tax_id="B10000002",
    )
    quote = _unregistered_quote(client, owner_headers)
    item_response = client.post(
        f"/api/v1/quotes/{quote['id']}/items",
        json={"description": "Servicio mensual", "quantity": 2, "unit_price": 75},
        headers=owner_headers,
    )
    assert item_response.status_code == 201
    assert client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"status": "sent"},
        headers=owner_headers,
    ).status_code == 200

    forbidden = client.post(
        f"/api/v1/quotes/{quote['id']}/accept",
        json={"register_client": False},
        headers=outsider_headers,
    )
    assert forbidden.status_code == 404

    accepted = client.post(
        f"/api/v1/quotes/{quote['id']}/accept",
        json={
            "register_client": True,
            "client": {
                "name": "Cliente Nuevo",
                "client_type": "company",
                "legal_number": "B12345679",
                "email": "cliente@example.com",
                "phone": "+34600999888",
                "address": "Calle Cliente 2",
                "city": "Barcelona",
                "province": "Barcelona",
                "postal_code": "08001",
                "country": "España",
            },
        },
        headers=owner_headers,
    )
    assert accepted.status_code == 200
    accepted_quote = accepted.json()
    assert accepted_quote["status"] == "accepted"
    assert accepted_quote["client_id"] is not None

    clients = client.get("/api/v1/clients/", headers=owner_headers).json()
    assert len(clients) == 1
    assert clients[0]["id"] == accepted_quote["client_id"]
    assert clients[0]["legal_number"] == "B12345679"

    repeated = client.post(
        f"/api/v1/quotes/{quote['id']}/accept",
        json={
            "register_client": True,
            "client": {
                "name": "Duplicated",
                "client_type": "company",
                "legal_number": "B12345679",
                "address": "Other",
                "city": "Barcelona",
                "postal_code": "08001",
                "country": "España",
            },
        },
        headers=owner_headers,
    )
    assert repeated.status_code == 400
    assert len(client.get("/api/v1/clients/", headers=owner_headers).json()) == 1


def test_quote_cannot_be_accepted_without_items(client):
    headers = _authenticated_company(
        client,
        email="empty-quote@example.com",
        company_name="Empty Quote",
        tax_id="B10000003",
    )
    quote = _unregistered_quote(client, headers)
    assert client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"status": "sent"},
        headers=headers,
    ).status_code == 200

    response = client.post(
        f"/api/v1/quotes/{quote['id']}/accept",
        json={"register_client": False},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A quote must contain at least one item"


@pytest.mark.parametrize(
    ("schema", "payload"),
    [
        (QuoteCreate, {"title": " ", "tax_rate": 0.21}),
        (QuoteCreate, {"title": "Valid", "tax_rate": 1.01}),
        (QuoteUpdate, {"discount": -1}),
        (QuoteItemCreate, {"description": " ", "quantity": 1, "unit_price": 10}),
        (QuoteItemCreate, {"description": "Service", "quantity": 0, "unit_price": 10}),
        (QuoteItemCreate, {"description": "Service", "quantity": 1, "unit_price": -1}),
        (QuoteItemUpdate, {"unit_price": -1}),
        (InvoiceItemCreate, {"description": "Service", "quantity": 1, "unit_price": -1}),
    ],
)
def test_billing_contracts_reject_invalid_values(schema, payload):
    with pytest.raises(ValidationError):
        schema.model_validate(payload)


def test_reservation_requires_at_least_one_guest():
    with pytest.raises(ValidationError):
        ReservationCreate.model_validate(
            {
                "location_id": 1,
                "check_in_at": "2026-07-23T12:00:00Z",
                "check_out_at": "2026-07-24T12:00:00Z",
                "guest_count": 0,
            }
        )
