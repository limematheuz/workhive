from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.client import Client
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.invoice_email_contact import InvoiceEmailContact
from app.models.user import User
from app.core.security import create_access_token
from app.schemas.invoice import (
    InvoiceDraftCreate,
    InvoiceEmailRequest,
    InvoiceUpdate,
    RectificationCreate,
)
from app.schemas.invoice_item import (
    InvoiceItemCreate,
    InvoiceItemResponse,
    RectificationInvoiceItemCreate,
)
from app.services import invoice_service
from tests.test_reservations import _company


def _billing_client(db, company, *, legal_number: str | None = "B12345678"):
    client = Client(
        company_id=company.id,
        name="Customer SL",
        client_type="company",
        legal_number=legal_number,
        address="Calle Cliente 10",
        city="Girona",
        postal_code="17001",
        country="Spain",
        email="billing@customer.test",
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _draft_payload(client_id: int) -> InvoiceDraftCreate:
    return InvoiceDraftCreate(
        client_id=client_id,
        issue_date=datetime.now(timezone.utc),
        discount=10,
        equivalence_surcharge=5.2,
        retention=2,
        items=[
            InvoiceItemCreate(
                description="Cleaning service",
                quantity=1,
                unit_price=100,
                tax_rate=0.21,
            )
        ],
    )


def test_invoice_draft_and_issue_are_consistent_and_chained(db):
    company = _company(db, "Issuer SL", "A12345678")
    company.swift_bic = "CAIXESBBXXX"
    db.commit()
    client = _billing_client(db, company)

    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )

    assert draft.status == "draft"
    assert draft.invoice_number.startswith("DRAFT-")
    assert draft.base_amount == Decimal("90.00")
    assert draft.tax_amount == Decimal("23.58")
    assert draft.total_amount == Decimal("111.78")

    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    assert issued.status == "issued"
    assert issued.invoice_number.startswith("INV-")
    assert issued.issued_at is not None
    assert issued.invoice_hash is not None
    assert issued.issuer_snapshot["tax_id"] == company.tax_id
    assert issued.issuer_snapshot["swift_bic"] == "CAIXESBBXXX"
    assert issued.recipient_snapshot["tax_id"] == client.legal_number
    assert issued.pdf_generated_at is not None
    assert issued.pdf_sha256 is not None
    pdf_path = Path(issued.pdf_path)
    pdf_bytes = pdf_path.read_bytes()
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1_000
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == issued.id)
        .one()
    )
    assert record.record_hash == issued.invoice_hash
    assert record.payload["invoice"]["total_amount"] == "111.78"
    assert record.submission_status == "not_configured"

    original_pdf_hash = issued.pdf_sha256
    original_pdf_bytes = pdf_bytes
    repeated = invoice_service.issue_invoice(db, company.id, draft.id)
    _, resolved_path = invoice_service.get_invoice_pdf(
        db, company.id, repeated.id
    )
    assert repeated.pdf_sha256 == original_pdf_hash
    assert resolved_path.read_bytes() == original_pdf_bytes


def test_full_rectification_preserves_original_and_matches_negative_total(db):
    company = _company(db, "Issuer SL", "A87654321")
    client = _billing_client(db, company, legal_number="B87654321")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )
    original = invoice_service.issue_invoice(db, company.id, draft.id)

    rectification = invoice_service.create_rectification_invoice(
        db,
        company.id,
        original.id,
        RectificationCreate(
            reason="Incorrect amount",
            issue_date=datetime.now(timezone.utc),
        ),
    )

    db.refresh(original)
    assert original.status == "rectified"
    assert rectification.status == "issued"
    assert rectification.invoice_number.startswith("R-")
    assert rectification.total_amount == -original.total_amount
    assert rectification.base_amount == -original.base_amount
    assert rectification.tax_amount == -original.tax_amount
    assert rectification.invoice_hash is not None
    assert rectification.pdf_sha256 is not None
    assert Path(rectification.pdf_path).read_bytes().startswith(b"%PDF-")


def test_only_rectification_lines_can_use_negative_prices():
    with pytest.raises(ValidationError):
        InvoiceItemCreate(
            description="Negative ordinary line",
            quantity=1,
            unit_price=-100,
            tax_rate=0.21,
        )

    rectification = RectificationInvoiceItemCreate(
        description="Rectification line",
        quantity=1,
        unit_price=-100,
        tax_rate=0.21,
    )
    response = InvoiceItemResponse.model_validate(
        {
            **rectification.model_dump(),
            "id": 1,
            "invoice_id": 1,
            "subtotal": -100,
            "total": -121,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    assert response.unit_price == -100


def test_issue_without_recipient_tax_id_uses_simplified_f2_record(db):
    company = _company(db, "Issuer SL", "A11223344")
    client = _billing_client(db, company, legal_number=None)
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )

    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    assert issued.status == "issued"
    assert issued.recipient_snapshot["tax_id"] == ""
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == issued.id)
        .one()
    )
    assert record.payload["official"]["invoice_type"] == "F2"
    assert record.payload["official"]["recipient_tax_id"] is None
    assert "<sum1:FacturaSinIdentifDestinatarioArt61d>S</sum1:FacturaSinIdentifDestinatarioArt61d>" in record.request_xml
    assert "Destinatarios" not in record.request_xml


def test_issue_preserves_custom_invoice_number(db):
    company = _company(db, "Issuer SL", "A11223349")
    client = _billing_client(db, company, legal_number="B11223349")
    payload = _draft_payload(client.id)
    payload.invoice_number = "FV/2026/0069"
    draft = invoice_service.create_invoice_draft(db, company.id, payload)

    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    assert issued.invoice_number == "FV/2026/0069"
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == issued.id)
        .one()
    )
    assert record.payload["official"]["invoice_number"] == "FV/2026/0069"
    assert "FV/2026/0069" in record.request_xml


def test_draft_update_allows_invoice_number_and_recipient_tax_data(db):
    company = _company(db, "Issuer SL", "A11223350")
    client = _billing_client(db, company, legal_number=None)
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )

    updated = invoice_service.update_invoice(
        db,
        company.id,
        draft.id,
        InvoiceUpdate(
            invoice_number="FV/2026/0070",
            custom_recipient_info=(
                "Customer SL\n"
                "NIF/CIF: B44556677\n"
                "Dirección: Calle Fiscal 25\n"
                "Teléfono: \n"
                "Email: billing@customer.test"
            ),
        ),
    )

    assert updated.invoice_number == "FV/2026/0070"
    assert "B44556677" in (updated.custom_recipient_info or "")


def test_issue_uses_custom_recipient_tax_data_from_draft(db):
    company = _company(db, "Issuer SL", "A11223345")
    client = _billing_client(db, company, legal_number=None)
    payload = _draft_payload(client.id)
    payload.custom_recipient_info = (
        "Customer SL\n"
        "NIF/CIF: B44556677\n"
        "Dirección: Calle Fiscal 25\n"
        "Teléfono: \n"
        "Email: billing@customer.test"
    )
    draft = invoice_service.create_invoice_draft(db, company.id, payload)

    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    assert issued.status == "issued"
    assert issued.recipient_snapshot["tax_id"] == "B44556677"
    assert issued.recipient_snapshot["address"] == "Calle Fiscal 25"


def test_issue_normalizes_tax_id_separators_before_fiscal_record(db):
    company = _company(db, "Issuer SL", "ES-A11223346")
    client = _billing_client(db, company, legal_number="38106814-T")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )

    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    assert issued.issuer_snapshot["tax_id"] == "A11223346"
    assert issued.recipient_snapshot["tax_id"] == "38106814T"
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == issued.id)
        .one()
    )
    assert record.payload["official"]["issuer_tax_id"] == "A11223346"
    assert record.payload["official"]["recipient_tax_id"] == "38106814T"
    assert "38106814T" in record.request_xml


def test_issue_rejects_invalid_tax_id_without_schema_error(db):
    company = _company(db, "Issuer SL", "A11223347")
    client = _billing_client(db, company, legal_number="123")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )

    with pytest.raises(HTTPException) as error:
        invoice_service.issue_invoice(db, company.id, draft.id)

    assert error.value.status_code == 422
    assert error.value.detail == "Cannot issue invoice. Invalid: recipient tax ID"
    db.refresh(draft)
    assert draft.status == "draft"


def test_issued_invoice_uses_snapshot_email_and_stored_pdf(
    db, monkeypatch
):
    company = _company(db, "Email Issuer SL", "A99887766")
    client = _billing_client(db, company, legal_number="B99887766")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )
    issued = invoice_service.issue_invoice(db, company.id, draft.id)
    delivered = {}

    def capture_invoice_email(**kwargs):
        delivered.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        capture_invoice_email,
    )
    emailed_invoice, recipient_email = invoice_service.email_invoice(
        db,
        company.id,
        issued.id,
        InvoiceEmailRequest(),
    )

    assert emailed_invoice.id == issued.id
    assert recipient_email == client.email
    assert delivered["recipient_email"] == [client.email]
    assert delivered["pdf_path"].read_bytes().startswith(b"%PDF-")


def test_draft_invoice_email_sends_proforma_without_fiscal_record(
    db, monkeypatch
):
    company = _company(db, "Draft Email Issuer SL", "A99887765")
    client = _billing_client(db, company, legal_number=None)
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )
    delivered = {}

    def capture_invoice_email(**kwargs):
        delivered.update(kwargs)
        assert kwargs["pdf_path"].read_bytes().startswith(b"%PDF-")
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        capture_invoice_email,
    )

    emailed_invoice, recipient_email = invoice_service.email_invoice(
        db,
        company.id,
        draft.id,
        InvoiceEmailRequest(),
    )

    assert emailed_invoice.id == draft.id
    assert recipient_email == client.email
    assert delivered["document_label"] == "Proforma"
    db.refresh(draft)
    assert draft.status == "draft"
    assert draft.invoice_hash is None
    assert draft.pdf_path is None
    assert (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == draft.id)
        .count()
        == 0
    )


def test_invoice_email_delivery_errors_return_service_unavailable(
    db, monkeypatch
):
    company = _company(db, "Email Error Issuer SL", "A99887767")
    client = _billing_client(db, company, legal_number="B99887767")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )
    issued = invoice_service.issue_invoice(db, company.id, draft.id)

    def fail_invoice_email(**kwargs):
        raise ValueError("invalid email header")

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        fail_invoice_email,
    )

    with pytest.raises(HTTPException) as error:
        invoice_service.email_invoice(
            db,
            company.id,
            issued.id,
            InvoiceEmailRequest(),
        )

    assert error.value.status_code == 503
    assert error.value.detail == (
        "Invoice email delivery is not configured or unavailable"
    )


def test_invoice_email_allows_external_recipient_and_sender_copy(
    db, monkeypatch
):
    company = _company(db, "External Email Issuer SL", "A99887768")
    client = _billing_client(db, company, legal_number="B99887768")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(client.id)
    )
    issued = invoice_service.issue_invoice(db, company.id, draft.id)
    delivered = {}

    def capture_invoice_email(**kwargs):
        delivered.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        capture_invoice_email,
    )

    _, recipient_email = invoice_service.email_invoice(
        db,
        company.id,
        issued.id,
        InvoiceEmailRequest(
            recipient_emails=["external@example.com", "other@example.com"],
            copy_emails=["copy@example.com"],
            subject="Factura externa",
            message="Mensaje externo",
            send_copy=True,
            save_recipients=True,
        ),
        sender_email="admin@example.com",
    )

    assert recipient_email == "external@example.com, other@example.com"
    assert delivered["recipient_email"] == [
        "external@example.com",
        "other@example.com",
    ]
    assert delivered["copy_emails"] == ["copy@example.com"]
    assert delivered["subject"] == "Factura externa"
    assert delivered["custom_message"] == "Mensaje externo"
    assert delivered["sender_copy_email"] == "admin@example.com"
    saved_contacts = (
        db.query(InvoiceEmailContact)
        .filter(InvoiceEmailContact.company_id == company.id)
        .order_by(InvoiceEmailContact.email.asc())
        .all()
    )
    assert [contact.email for contact in saved_contacts] == [
        "external@example.com",
        "other@example.com",
    ]
    assert all(contact.use_count == 1 for contact in saved_contacts)


def test_invoice_email_updates_client_email_only_when_explicitly_requested(
    db, monkeypatch
):
    company = _company(db, "Saved Invoice Recipient SL", "A99887770")
    billing_client = _billing_client(db, company, legal_number="B99887770")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(billing_client.id)
    )
    issued = invoice_service.issue_invoice(db, company.id, draft.id)
    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        lambda **_: True,
    )

    invoice_service.email_invoice(
        db,
        company.id,
        issued.id,
        InvoiceEmailRequest(
            recipient_emails=["confirmed-invoice-client@example.com"],
            save_recipient_to_client_id=billing_client.id,
        ),
    )

    db.refresh(billing_client)
    assert billing_client.email == "confirmed-invoice-client@example.com"
    assert (
        db.query(InvoiceEmailContact)
        .filter(
            InvoiceEmailContact.company_id == company.id,
            InvoiceEmailContact.email == "confirmed-invoice-client@example.com",
        )
        .first()
        is None
    )


def test_invoice_email_api_allows_external_recipient(client, db, monkeypatch):
    company = _company(db, "Email API Issuer SL", "A99887769")
    company.subscription_plan = "pro"
    company.subscription_status = "active"
    db.add(company)
    db.commit()
    admin = User(
        email="invoice-api-admin@example.com",
        hashed_password="unused",
        full_name="Invoice API Admin",
        role_id=1,
        company_id=company.id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    billing_client = _billing_client(db, company, legal_number="B99887769")
    draft = invoice_service.create_invoice_draft(
        db, company.id, _draft_payload(billing_client.id)
    )
    issued = invoice_service.issue_invoice(db, company.id, draft.id)
    delivered = {}

    def capture_invoice_email(**kwargs):
        delivered.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        capture_invoice_email,
    )

    token = create_access_token({"sub": admin.email, "ver": admin.session_version})
    response = client.post(
        f"/api/v1/invoices/{issued.id}/send-email",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "recipient_emails": ["external@example.com", "other@example.com"],
            "copy_emails": ["copy@example.com"],
            "subject": "Factura API",
            "message": "Mensaje API",
            "send_copy": True,
            "save_recipients": True,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "status": "sent",
        "recipient_email": "external@example.com, other@example.com",
    }
    assert delivered["recipient_email"] == [
        "external@example.com",
        "other@example.com",
    ]
    assert delivered["copy_emails"] == ["copy@example.com"]
    assert delivered["sender_copy_email"] == admin.email

    contacts = client.get(
        "/api/v1/invoice-email-contacts/?q=external",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contacts.status_code == 200, contacts.text
    saved_contacts = contacts.json()
    assert [contact["email"] for contact in saved_contacts] == [
        "external@example.com",
    ]
    assert saved_contacts[0]["name"] is None
