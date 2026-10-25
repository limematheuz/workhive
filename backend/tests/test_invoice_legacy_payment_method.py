from pydantic import ValidationError
import pytest

from app.core.security import create_access_token
from app.models.user import User
from app.schemas.invoice import InvoiceDraftCreate, InvoiceListResponse, InvoiceUpdate
from app.services import invoice_service
from tests.test_invoice_fiscal_flow import _billing_client, _draft_payload
from tests.test_reservations import _company


def _headers(db, company, email):
    admin = User(
        email=email, hashed_password="unused", full_name="Reader",
        role_id=1, company_id=company.id,
    )
    db.add(admin)
    db.commit()
    token = create_access_token({"sub": admin.email, "ver": admin.session_version})
    return {"Authorization": f"Bearer {token}"}


def test_legacy_transfer_is_readable_without_rewriting_fiscal_data(client, db):
    company = _company(db, "Legacy Issuer", "A12345678")
    company.subscription_plan = "pro"
    company.subscription_status = "active"
    db.commit()
    headers = _headers(db, company, "legacy-invoice-reader@example.com")
    customer = _billing_client(db, company)
    draft = invoice_service.create_invoice_draft(db, company.id, _draft_payload(customer.id))
    issued = invoice_service.issue_invoice(db, company.id, draft.id)
    issued.payment_method = "transfer"
    db.commit()
    db.refresh(issued)
    stored_updated_at = issued.updated_at
    stored_hash = issued.invoice_hash
    stored_pdf_hash = issued.pdf_sha256
    _, document = invoice_service.get_invoice_pdf(db, company.id, issued.id)
    stored_pdf_bytes = document.contents

    listing = client.get("/api/v1/invoices/", headers=headers)
    assert listing.status_code == 200
    assert [(item["id"], item["payment_method"]) for item in listing.json()] == [
        (issued.id, "bank_transfer")
    ]
    detail = client.get(f"/api/v1/invoices/{issued.id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["payment_method"] == "bank_transfer"
    db.refresh(issued)
    assert issued.payment_method == "transfer"
    assert issued.updated_at == stored_updated_at
    assert issued.invoice_hash == stored_hash
    assert issued.pdf_sha256 == stored_pdf_hash
    _, reread_document = invoice_service.get_invoice_pdf(db, company.id, issued.id)
    assert reread_document.contents == stored_pdf_bytes

    payload = _draft_payload(customer.id).model_dump()
    for invalid in ["transfer", "crypto"]:
        with pytest.raises(ValidationError):
            InvoiceDraftCreate.model_validate({**payload, "payment_method": invalid})
        with pytest.raises(ValidationError):
            InvoiceUpdate.model_validate({"payment_method": invalid})
    with pytest.raises(ValidationError):
        InvoiceListResponse.model_validate({**listing.json()[0], "payment_method": "crypto"})

    outsider = _company(db, "Other Issuer", "A99887769")
    outsider.subscription_plan = "pro"
    outsider.subscription_status = "active"
    db.commit()
    outsider_headers = _headers(db, outsider, "other-invoice-reader@example.com")
    other_list = client.get("/api/v1/invoices/", headers=outsider_headers)
    assert other_list.status_code == 200
    assert other_list.json() == []
    assert client.get(
        f"/api/v1/invoices/{issued.id}", headers=outsider_headers
    ).status_code == 404
