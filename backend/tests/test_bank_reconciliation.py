from datetime import datetime, timezone

from app.models.bank_reconciliation import BankReconciliation
from tests.test_customer_payments import _client, _invoice, _payment_payload
from tests.test_location_workspace import _admin, _company, _headers


def _payment(client, admin, customer_id: int, invoice_id: int, amount: str = "100.00"):
    response = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer_id,
            amount,
            [{"invoice_id": invoice_id, "amount": amount}],
        ),
    )
    assert response.status_code == 201, response.text
    return response.json()


def _entry_payload(amount: str = "100.00", external_id: str = "BANK-ENTRY-001"):
    return {
        "booked_at": datetime(2026, 9, 13, 10, 0, tzinfo=timezone.utc).isoformat(),
        "amount": amount,
        "currency": "eur",
        "account_label": "Cuenta principal",
        "external_id": external_id,
        "reference": "TRANSFERENCIA CLIENTE",
        "counterparty": "Cliente de pruebas",
    }


def test_bank_entry_matches_receipt_and_requires_explicit_unmatch_before_void(
    client, db
):
    company = _company(db, "BankReconciliationOwner")
    admin = _admin(db, company)
    customer = _client(db, company, "Cliente conciliación")
    invoice = _invoice(db, company, customer, number="INV-BANK-01")
    payment = _payment(client, admin, customer.id, invoice.id)

    entry = client.post(
        "/api/v1/bank-reconciliation/entries",
        headers=_headers(admin),
        json=_entry_payload(),
    )
    assert entry.status_code == 201, entry.text
    assert entry.json()["status"] == "unmatched"
    assert entry.json()["currency"] == "EUR"

    matched = client.post(
        f"/api/v1/bank-reconciliation/entries/{entry.json()['id']}/match",
        headers=_headers(admin),
        json={"customer_payment_id": payment["id"]},
    )
    assert matched.status_code == 200, matched.text
    assert matched.json()["status"] == "matched"
    assert matched.json()["current_reconciliation"]["payment"]["id"] == payment["id"]

    blocked_void = client.post(
        f"/api/v1/customer-payments/{payment['id']}/void",
        headers=_headers(admin),
        json={"reason": "El banco rechazó el cargo"},
    )
    assert blocked_void.status_code == 409

    unmatched = client.post(
        f"/api/v1/bank-reconciliation/entries/{entry.json()['id']}/unmatch",
        headers=_headers(admin),
        json={"reason": "El extracto pertenece a otro cobro"},
    )
    assert unmatched.status_code == 200, unmatched.text
    assert unmatched.json()["status"] == "unmatched"
    assert unmatched.json()["current_reconciliation"] is None
    reconciliation = db.query(BankReconciliation).one()
    assert reconciliation.status == "reversed"
    assert reconciliation.reversal_reason == "El extracto pertenece a otro cobro"

    voided = client.post(
        f"/api/v1/customer-payments/{payment['id']}/void",
        headers=_headers(admin),
        json={"reason": "El banco rechazó el cargo"},
    )
    assert voided.status_code == 200, voided.text


def test_bank_reconciliation_rejects_cross_tenant_reused_or_mismatched_receipts(
    client, db
):
    owner = _company(db, "BankReconciliationOwnerTwo")
    other = _company(db, "BankReconciliationOther")
    owner_admin = _admin(db, owner)
    other_admin = _admin(db, other)
    owner_customer = _client(db, owner, "Cliente propietario banco")
    other_customer = _client(db, other, "Cliente ajeno banco")
    owner_invoice = _invoice(db, owner, owner_customer, number="INV-BANK-OWNER")
    other_invoice = _invoice(db, other, other_customer, number="INV-BANK-OTHER")
    owner_payment = _payment(client, owner_admin, owner_customer.id, owner_invoice.id)
    other_payment = _payment(client, other_admin, other_customer.id, other_invoice.id)

    entry = client.post(
        "/api/v1/bank-reconciliation/entries",
        headers=_headers(owner_admin),
        json=_entry_payload(amount="90.00", external_id="BANK-ENTRY-MISMATCH"),
    )
    assert entry.status_code == 201, entry.text

    foreign = client.post(
        f"/api/v1/bank-reconciliation/entries/{entry.json()['id']}/match",
        headers=_headers(owner_admin),
        json={"customer_payment_id": other_payment["id"]},
    )
    assert foreign.status_code == 404

    mismatch = client.post(
        f"/api/v1/bank-reconciliation/entries/{entry.json()['id']}/match",
        headers=_headers(owner_admin),
        json={"customer_payment_id": owner_payment["id"]},
    )
    assert mismatch.status_code == 422

    matching_entry = client.post(
        "/api/v1/bank-reconciliation/entries",
        headers=_headers(owner_admin),
        json=_entry_payload(external_id="BANK-ENTRY-OWNER"),
    )
    assert matching_entry.status_code == 201, matching_entry.text
    matched = client.post(
        f"/api/v1/bank-reconciliation/entries/{matching_entry.json()['id']}/match",
        headers=_headers(owner_admin),
        json={"customer_payment_id": owner_payment["id"]},
    )
    assert matched.status_code == 200, matched.text

    reused_entry = client.post(
        "/api/v1/bank-reconciliation/entries",
        headers=_headers(owner_admin),
        json=_entry_payload(external_id="BANK-ENTRY-OWNER-SECOND"),
    )
    assert reused_entry.status_code == 201, reused_entry.text
    reused = client.post(
        f"/api/v1/bank-reconciliation/entries/{reused_entry.json()['id']}/match",
        headers=_headers(owner_admin),
        json={"customer_payment_id": owner_payment["id"]},
    )
    assert reused.status_code == 409

    duplicate_external_id = client.post(
        "/api/v1/bank-reconciliation/entries",
        headers=_headers(owner_admin),
        json=_entry_payload(external_id="BANK-ENTRY-OWNER"),
    )
    assert duplicate_external_id.status_code == 409
