from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.models.client import Client
from app.schemas.company import CompanyPartnerResponse
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.schemas.invoice_item import InvoiceItemCreate, InvoiceItemUpdate
from app.schemas.location import LocationCreate
from app.schemas.quote import QuoteCreate, QuoteUpdate
from credentials import TEST_SECRET, CREDENTIAL_FIELD, login_form
from app.services import invoice_item_service, invoice_service, quote_service, request_context
from app.services.request_context import get_client_ip, get_request_location_details
from tests.test_reservations import _company


def _client(db, company_id: int, suffix: str) -> Client:
    client = Client(
        name=f"Client {suffix}",
        legal_number=f"LEGAL-{suffix}",
        address="Test Street 1",
        city="Girona",
        postal_code="17001",
        country="Spain",
        company_id=company_id,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _invoice(db, company_id: int, client_id: int):
    return invoice_service.create_invoice(
        db,
        company_id,
        InvoiceCreate(
            client_id=client_id,
            issue_date=datetime.now(timezone.utc),
        ),
    )


def test_quotes_reject_clients_from_another_company(db):
    first = _company(db, "First", "FIRST")
    second = _company(db, "Second", "SECOND")
    first_client = _client(db, first.id, "FIRST")
    second_client = _client(db, second.id, "SECOND")

    with pytest.raises(HTTPException) as create_error:
        quote_service.create_quote(
            db,
            first.id,
            QuoteCreate(client_id=second_client.id, title="Cross-tenant quote"),
        )
    assert create_error.value.status_code == 404

    quote = quote_service.create_quote(
        db,
        first.id,
        QuoteCreate(client_id=first_client.id, title="Own quote"),
    )
    with pytest.raises(HTTPException) as update_error:
        quote_service.update_quote(
            db,
            first.id,
            quote.id,
            QuoteUpdate(client_id=second_client.id),
        )
    assert update_error.value.status_code == 404


def test_invoices_reject_client_reassignment_across_companies(db):
    first = _company(db, "First Invoice", "FIRSTINV")
    second = _company(db, "Second Invoice", "SECONDINV")
    first_client = _client(db, first.id, "FIRSTINV")
    second_client = _client(db, second.id, "SECONDINV")
    invoice = _invoice(db, first.id, first_client.id)

    with pytest.raises(HTTPException) as error:
        invoice_service.update_invoice(
            db,
            first.id,
            invoice.id,
            InvoiceUpdate(client_id=second_client.id),
        )
    assert error.value.status_code == 404


def test_invoice_item_routes_require_matching_parent_invoice(db):
    company = _company(db, "Invoice Items", "ITEMS")
    client = _client(db, company.id, "ITEMS")
    first_invoice = _invoice(db, company.id, client.id)
    second_invoice = _invoice(db, company.id, client.id)
    item = invoice_item_service.create_invoice_item(
        db,
        company.id,
        first_invoice.id,
        InvoiceItemCreate(description="Line", unit_price=10),
    )

    with pytest.raises(HTTPException) as update_error:
        invoice_item_service.update_invoice_item(
            db,
            company.id,
            second_invoice.id,
            item.id,
            InvoiceItemUpdate(description="Wrong parent"),
        )
    assert update_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        invoice_item_service.delete_invoice_item(
            db,
            company.id,
            second_invoice.id,
            item.id,
        )
    assert delete_error.value.status_code == 404


def test_client_ip_does_not_trust_client_supplied_forwarding_headers():
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(b"x-forwarded-for", b"203.0.113.50")],
            "client": ("198.51.100.10", 8000),
        }
    )

    assert get_client_ip(request) == "198.51.100.10"


def test_request_location_ignores_spoofed_cdn_geo_headers(monkeypatch):
    request = Request(
        {
            "type": "http",
            "headers": [
                (b"cf-ipcity", b"Washington"),
                (b"cf-ipcountry", b"US"),
                (b"x-vercel-ip-latitude", b"38.9072"),
                (b"x-vercel-ip-longitude", b"-77.0369"),
            ],
            "client": ("8.8.8.8", 8000),
        }
    )
    monkeypatch.setattr(
        request_context,
        "_lookup_public_ip_location",
        lambda ip_address: {
            "country": "Spain",
            "region": "Catalonia",
            "city": "Girona",
            "latitude": 41.98,
            "longitude": 2.82,
        },
    )

    details = get_request_location_details(request)

    assert details["ip"] == "8.8.8.8"
    assert details["geo"] == {
        "country": "Spain",
        "region": "Catalonia",
        "city": "Girona",
        "latitude": 41.98,
        "longitude": 2.82,
    }


def test_request_location_skips_geolocation_for_anonymous_events(monkeypatch):
    request = Request({"type": "http", "headers": [], "client": ("8.8.8.8", 8000)})
    monkeypatch.setattr(
        request_context,
        "_lookup_public_ip_location",
        lambda ip_address: pytest.fail("anonymous page views must not trigger IP geolocation"),
    )

    details = get_request_location_details(request, include_geolocation=False)

    assert details["ip"] == "8.8.8.8"
    assert details["geo"] == {}


def test_partner_company_response_excludes_private_billing_fields(db):
    company = _company(db, "Partner", "PARTNER")
    company.bank_account = "ES0000000000000000000000"
    company.default_payment_notes = "Private payment notes"
    company.default_document_terms = "Private document terms"
    db.add(company)
    db.commit()

    payload = CompanyPartnerResponse.model_validate(company).model_dump()

    assert "bank_account" not in payload
    assert "default_payment_notes" not in payload
    assert "default_document_terms" not in payload


def test_pagination_parameters_are_bounded(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "pagination@example.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Pagination User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registration.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("pagination@example.com", TEST_SECRET),
    )

    response = client.get(
        "/api/v1/roles/?limit=501",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )

    assert response.status_code == 422


def test_location_map_url_rejects_script_schemes():
    with pytest.raises(ValueError, match="HTTPS Google Maps or Waze"):
        LocationCreate(
            name="Unsafe location",
            address="Test Street 1",
            city="Girona",
            map_url="javascript:alert(1)",
        )

    location = LocationCreate(
        name="Safe location",
        address="Test Street 1",
        city="Girona",
        map_url="https://www.google.com/maps?q=Girona",
    )
    assert location.map_url == "https://www.google.com/maps?q=Girona"
