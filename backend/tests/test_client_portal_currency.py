from datetime import datetime, timezone
from copy import deepcopy

from app.models.invoice import Invoice
from app.services.client_portal_currency_projection import public_currency_snapshot
from test_client_portal_api import _company, _client, _internal_user, _portal_user, _grant


def _snapshot():
    return {
        "currency": "USD", "eur_rate": "0.9", "rate_date": "2026-01-01",
        "original_amounts": {"base_amount": "100", "tax_amount": "21", "total_amount": "121", "internal_margin": "30"},
        "eur_amounts": {"base_amount": "90", "tax_amount": "18.9", "total_amount": "108.9"},
        "original_lines": [{"description": "Limpieza", "quantity": "1", "unit_price": "100", "subtotal": "100", "total": "121", "tax_rate": "0.21", "internal_reference": "private-source"}],
        "rounding_difference_eur": "0.00", "source": "manual_verified", "verified_by": 99, "verified_at": "2026-01-01",
        "original_document": {"notes": "PRIVATE-NOTES", "custom_issuer_info": "PRIVATE-ISSUER", "signature_url": "PRIVATE-SIGNATURE"},
    }


def test_currency_projection_is_recursive_allowlist_without_mutating_snapshot():
    source = _snapshot()
    before = deepcopy(source)
    result = public_currency_snapshot(source)
    assert source == before
    assert result["currency"] == "USD"
    assert result["original_amounts"]["total_amount"] == "121"
    assert "original_document" not in result and "verified_by" not in result and "source" not in result
    assert "internal_margin" not in result["original_amounts"]
    assert "internal_reference" not in result["original_lines"][0]
    assert public_currency_snapshot(None) is None


def test_client_portal_invoice_returns_original_currency_without_private_metadata(client, db):
    company = _company(db, "FX-PUBLIC")
    admin, _ = _internal_user(db, company=company, suffix="FX-PUBLIC")
    customer = _client(db, company=company, suffix="FX-PUBLIC")
    other = _client(db, company=company, suffix="FX-OTHER")
    user, headers = _portal_user(db, email="fx-customer@example.com", suffix="FX-PUBLIC")
    grant = _grant(db, company=company, customer=customer, user=user, admin=admin)
    own = Invoice(company_id=company.id, client_id=customer.id, invoice_number="FX-PUBLIC", issue_date=datetime(2026, 1, 2, tzinfo=timezone.utc), status="issued", base_amount=90, tax_amount=18.9, total_amount=108.9, currency_snapshot=_snapshot())
    foreign = Invoice(company_id=company.id, client_id=other.id, invoice_number="FX-OTHER", issue_date=datetime(2026, 1, 2, tzinfo=timezone.utc), status="issued", base_amount=90, tax_amount=18.9, total_amount=108.9, currency_snapshot=_snapshot())
    db.add_all([own, foreign]); db.commit()
    response = client.get(f"/api/v1/client-portal/workspaces/{grant.id}/overview", headers=headers)
    assert response.status_code == 200, response.text
    rows = response.json()["invoices"]
    assert [row["id"] for row in rows] == [own.id]
    assert rows[0]["total_amount"] == 108.9
    snapshot = rows[0]["currency_snapshot"]
    assert snapshot["original_amounts"]["total_amount"] == "121"
    assert snapshot["original_lines"][0]["unit_price"] == "100"
    assert "PRIVATE" not in response.text and "private-source" not in response.text
    assert "original_document" not in snapshot and "verified_by" not in snapshot
    assert "internal_margin" not in snapshot["original_amounts"]
    assert client.get(f"/api/v1/client-portal/workspaces/{grant.id}/invoices/{foreign.id}/pdf", headers=headers).status_code == 404
