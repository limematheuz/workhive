from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import event

from app.models.client import Client
from app.models.invoice import Invoice
from tests.test_location_workspace import _admin, _company, _headers


def _invoice(db, company, client, *, number: str, amount: str = "100.00"):
    invoice = Invoice(
        company_id=company.id,
        client_id=client.id,
        invoice_number=number,
        issue_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc) + timedelta(days=30),
        status="issued",
        base_amount=Decimal(amount),
        tax_amount=Decimal("0"),
        total_amount=Decimal(amount),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def _client(db, company, name: str):
    client = Client(
        company_id=company.id,
        name=name,
        legal_number=f"{name.upper()}-NIF",
        address="Calle de pruebas 1",
        city="Madrid",
        postal_code="28001",
        country="España",
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _payment_payload(client_id: int, amount: str, allocations: list[dict]):
    return {
        "client_id": client_id,
        "received_at": "2026-09-12T12:00:00Z",
        "amount": amount,
        "payment_method": "bank_transfer",
        "reference": "COBRO-TEST-01",
        "allocations": allocations,
    }


def test_customer_payment_tracks_partial_and_full_collection(client, db):
    company = _company(db, "PaymentsOwner")
    admin = _admin(db, company)
    customer = _client(db, company, "Cliente cobros")
    invoice = _invoice(db, company, customer, number="INV-PAYMENT-01")

    first = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer.id,
            "40.00",
            [{"invoice_id": invoice.id, "amount": "40.00"}],
        ),
    )
    assert first.status_code == 201, first.text
    assert first.json()["allocated_amount"] == "40.00"
    assert first.json()["unapplied_amount"] == "0.00"
    db.refresh(invoice)
    assert invoice.status == "partially_paid"
    assert invoice.paid_at is None
    statements = []

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().lower().startswith("select") and "customer_payment_allocations" in statement:
            statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture_statement)
    try:
        listed = client.get("/api/v1/invoices/", headers=_headers(admin))
    finally:
        event.remove(db.bind, "before_cursor_execute", capture_statement)
    assert listed.status_code == 200, listed.text
    assert listed.json()[0]["collected_amount"] == 40.0
    assert len(statements) == 1, "The invoice list must batch collection totals in one query"

    second = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer.id,
            "60.00",
            [{"invoice_id": invoice.id, "amount": "60.00"}],
        ),
    )
    assert second.status_code == 201, second.text
    db.refresh(invoice)
    assert invoice.status == "paid"
    assert invoice.paid_at is not None
    listed = client.get("/api/v1/invoices/", headers=_headers(admin))
    assert listed.status_code == 200, listed.text
    assert listed.json()[0]["collected_amount"] == 100.0

    payments = client.get("/api/v1/customer-payments/", headers=_headers(admin))
    assert payments.status_code == 200, payments.text
    assert [item["id"] for item in payments.json()] == [second.json()["id"], first.json()["id"]]


def test_customer_payment_can_split_and_void_without_losing_the_audit_trail(client, db):
    company = _company(db, "PaymentsSplit")
    admin = _admin(db, company)
    customer = _client(db, company, "Cliente repartos")
    first_invoice = _invoice(db, company, customer, number="INV-SPLIT-01", amount="50.00")
    second_invoice = _invoice(db, company, customer, number="INV-SPLIT-02", amount="70.00")

    receipt = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer.id,
            "150.00",
            [
                {"invoice_id": first_invoice.id, "amount": "50.00"},
                {"invoice_id": second_invoice.id, "amount": "70.00"},
            ],
        ),
    )
    assert receipt.status_code == 201, receipt.text
    assert receipt.json()["allocated_amount"] == "120.00"
    assert receipt.json()["unapplied_amount"] == "30.00"
    db.refresh(first_invoice)
    db.refresh(second_invoice)
    assert (first_invoice.status, second_invoice.status) == ("paid", "paid")

    voided = client.post(
        f"/api/v1/customer-payments/{receipt.json()['id']}/void",
        headers=_headers(admin),
        json={"reason": "La transferencia fue devuelta"},
    )
    assert voided.status_code == 200, voided.text
    assert voided.json()["status"] == "voided"
    assert voided.json()["void_reason"] == "La transferencia fue devuelta"
    assert len(voided.json()["allocations"]) == 2
    db.refresh(first_invoice)
    db.refresh(second_invoice)
    assert (first_invoice.status, second_invoice.status) == ("issued", "issued")
    listed = client.get("/api/v1/invoices/", headers=_headers(admin))
    assert listed.status_code == 200, listed.text
    assert {item["invoice_number"]: item["collected_amount"] for item in listed.json()} == {
        "INV-SPLIT-01": 0.0,
        "INV-SPLIT-02": 0.0,
    }

    repeated = client.post(
        f"/api/v1/customer-payments/{receipt.json()['id']}/void",
        headers=_headers(admin),
        json={"reason": "No debe anularse dos veces"},
    )
    assert repeated.status_code == 409


def test_voiding_receipt_does_not_reopen_a_rectified_invoice(client, db):
    company = _company(db, "PaymentsRectified")
    admin = _admin(db, company)
    customer = _client(db, company, "Cliente rectificado")
    invoice = _invoice(db, company, customer, number="INV-RECTIFIED-01")

    receipt = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer.id,
            "40.00",
            [{"invoice_id": invoice.id, "amount": "40.00"}],
        ),
    )
    assert receipt.status_code == 201, receipt.text
    db.refresh(invoice)
    assert invoice.status == "partially_paid"

    invoice.status = "rectified"
    db.commit()

    voided = client.post(
        f"/api/v1/customer-payments/{receipt.json()['id']}/void",
        headers=_headers(admin),
        json={"reason": "El recibo QA era ficticio"},
    )
    assert voided.status_code == 200, voided.text
    db.refresh(invoice)
    assert invoice.status == "rectified"
    assert voided.json()["status"] == "voided"

    rejected = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(admin),
        json=_payment_payload(
            customer.id,
            "10.00",
            [{"invoice_id": invoice.id, "amount": "10.00"}],
        ),
    )
    assert rejected.status_code == 409


def test_customer_payment_rejects_foreign_or_overallocated_invoices(client, db):
    owner = _company(db, "PaymentsTenantOwner")
    other = _company(db, "PaymentsTenantOther")
    owner_admin = _admin(db, owner)
    customer = _client(db, owner, "Cliente propietario")
    other_customer = _client(db, other, "Cliente ajeno")
    invoice = _invoice(db, owner, customer, number="INV-OWNER-01")
    foreign_invoice = _invoice(db, other, other_customer, number="INV-OTHER-01")

    foreign = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(owner_admin),
        json=_payment_payload(
            customer.id,
            "10.00",
            [{"invoice_id": foreign_invoice.id, "amount": "10.00"}],
        ),
    )
    assert foreign.status_code == 404

    excessive = client.post(
        "/api/v1/customer-payments/",
        headers=_headers(owner_admin),
        json=_payment_payload(
            customer.id,
            "101.00",
            [{"invoice_id": invoice.id, "amount": "101.00"}],
        ),
    )
    assert excessive.status_code == 409
