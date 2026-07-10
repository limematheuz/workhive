from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.models.client import Client
from app.schemas.company import CompanyPartnerResponse
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.schemas.invoice_item import InvoiceItemCreate, InvoiceItemUpdate
from app.schemas.quote import QuoteCreate, QuoteUpdate
from app.services import invoice_item_service, invoice_service, quote_service
from app.services.request_context import get_client_ip
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
