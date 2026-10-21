from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import event

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
from app.models.customer_payment import CustomerPayment, CustomerPaymentAllocation
from app.models.invoice import Invoice
from app.models.user import User


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Ledger {suffix}",
        tax_id=f"LEDGER-{suffix}",
        address="Calle Fiscal 1",
        phone="600000000",
        email=f"ledger-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _headers(db, company: Company, role_id: int, suffix: str) -> dict[str, str]:
    user = User(
        email=f"{suffix}@ledger.test",
        hashed_password="unused",
        full_name=suffix,
        role_id=role_id,
        company_id=company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _issued_invoice(db, company: Company) -> Invoice:
    client = Client(
        company_id=company.id,
        name="Cliente automático",
        address="Calle Cliente 2",
        city="Girona",
        postal_code="17001",
        country="España",
        email="client@example.test",
    )
    db.add(client)
    db.flush()
    invoice = Invoice(
        company_id=company.id,
        client_id=client.id,
        invoice_number="INV-2026-0042",
        issue_date=datetime(2026, 8, 13, tzinfo=timezone.utc),
        status="issued",
        base_amount=Decimal("100.00"),
        tax_amount=Decimal("21.00"),
        total_amount=Decimal("121.00"),
        recipient_snapshot={"name": client.name},
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def _manual_payload(document_number: str = "FV/2025/0001") -> dict:
    return {
        "document_number": document_number,
        "entry_date": date(2025, 1, 5).isoformat(),
        "client_name": "Bosch",
        "base_amount": "438.60",
        "tax_amount": "92.11",
        "payment_status": "paid",
    }


def test_sales_ledger_includes_issued_invoices_as_read_only_automatic_rows(client, db):
    company = _company(db, "AUTOMATIC")
    headers = _headers(db, company, 1, "admin-automatic")
    invoice = _issued_invoice(db, company)

    response = client.get("/api/v1/sales-ledger/", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["source_type"] == "invoice"
    assert payload[0]["source_id"] == invoice.id
    assert payload[0]["document_number"] == invoice.invoice_number
    assert payload[0]["base_amount"] == 100.0
    assert payload[0]["tax_amount"] == 21.0
    assert payload[0]["total_amount"] == 121.0
    assert payload[0]["invoice_status"] == "issued"
    assert payload[0]["collected_amount"] == 0.0
    assert all(
        isinstance(payload[0][field], (int, float))
        for field in ("base_amount", "tax_amount", "total_amount")
    )
    assert payload[0]["is_editable"] is False


def test_sales_ledger_reports_partial_cash_and_rectifications_without_cross_tenant_receipts(client, db):
    company = _company(db, "CASH")
    other_company = _company(db, "CASH-OTHER")
    headers = _headers(db, company, 1, "admin-cash")
    _headers(db, other_company, 1, "admin-cash-other")
    partial = _issued_invoice(db, company)
    rectified = Invoice(
        company_id=company.id,
        client_id=partial.client_id,
        invoice_number="INV-2026-0043",
        issue_date=partial.issue_date,
        status="rectified",
        base_amount=Decimal("100.00"),
        tax_amount=Decimal("21.00"),
        total_amount=Decimal("121.00"),
    )
    credit = Invoice(
        company_id=company.id,
        client_id=partial.client_id,
        invoice_number="R-2026-0043",
        issue_date=partial.issue_date,
        status="issued",
        is_rectification=True,
        original_invoice=rectified,
        base_amount=Decimal("-100.00"),
        tax_amount=Decimal("-21.00"),
        total_amount=Decimal("-121.00"),
    )
    db.add_all([rectified, credit])
    db.flush()
    partial.status = "partially_paid"
    for invoice, amount in ((partial, "40.00"), (rectified, "50.00")):
        receipt = CustomerPayment(
            company_id=company.id,
            client_id=invoice.client_id,
            received_at=partial.issue_date,
            amount=Decimal(amount),
            status="received",
        )
        db.add(receipt)
        db.flush()
        db.add(CustomerPaymentAllocation(payment_id=receipt.id, invoice_id=invoice.id, amount=Decimal(amount)))
    voided_receipt = CustomerPayment(
        company_id=company.id,
        client_id=partial.client_id,
        received_at=partial.issue_date,
        amount=Decimal("11.00"),
        status="voided",
    )
    db.add(voided_receipt)
    db.flush()
    db.add(CustomerPaymentAllocation(payment_id=voided_receipt.id, invoice_id=partial.id, amount=Decimal("11.00")))
    other_invoice = _issued_invoice(db, other_company)
    other_receipt = CustomerPayment(
        company_id=other_company.id,
        client_id=other_invoice.client_id,
        received_at=other_invoice.issue_date,
        amount=Decimal("99.00"),
        status="received",
    )
    db.add(other_receipt)
    db.flush()
    db.add(CustomerPaymentAllocation(payment_id=other_receipt.id, invoice_id=other_invoice.id, amount=Decimal("99.00")))
    db.commit()

    allocation_queries = []

    def capture_allocations(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().lower().startswith("select") and "customer_payment_allocations" in statement:
            allocation_queries.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture_allocations)
    try:
        response = client.get("/api/v1/sales-ledger/", headers=headers)
    finally:
        event.remove(db.bind, "before_cursor_execute", capture_allocations)
    assert response.status_code == 200, response.text
    entries = {entry["document_number"]: entry for entry in response.json()}
    assert set(entries) == {partial.invoice_number, rectified.invoice_number, credit.invoice_number}
    assert entries[partial.invoice_number]["invoice_status"] == "partially_paid"
    assert entries[partial.invoice_number]["collected_amount"] == 40.0
    assert entries[rectified.invoice_number]["invoice_status"] == "rectified"
    assert entries[rectified.invoice_number]["collected_amount"] == 50.0
    assert entries[credit.invoice_number]["is_rectification"] is True
    assert entries[credit.invoice_number]["collected_amount"] == 0.0
    assert len(allocation_queries) == 1


def test_manual_history_is_calculated_editable_and_isolated_per_company(client, db):
    company = _company(db, "PRIMARY")
    other_company = _company(db, "OTHER")
    headers = _headers(db, company, 1, "admin-primary")
    other_headers = _headers(db, other_company, 1, "admin-other")

    created = client.post(
        "/api/v1/sales-ledger/manual-records",
        headers=headers,
        json=_manual_payload(),
    )

    assert created.status_code == 201
    record = created.json()
    assert record["source_type"] == "manual"
    assert record["total_amount"] == 530.71
    assert record["invoice_status"] is None
    assert record["collected_amount"] is None
    assert record["is_editable"] is True

    updated = client.patch(
        f"/api/v1/sales-ledger/manual-records/{record['source_id']}",
        headers=headers,
        json={"base_amount": "80.00", "tax_amount": "16.80"},
    )
    assert updated.status_code == 200
    assert updated.json()["total_amount"] == 96.8

    forbidden = client.delete(
        f"/api/v1/sales-ledger/manual-records/{record['source_id']}",
        headers=other_headers,
    )
    assert forbidden.status_code == 404

    assert client.delete(
        f"/api/v1/sales-ledger/manual-records/{record['source_id']}",
        headers=headers,
    ).status_code == 204
    assert client.get("/api/v1/sales-ledger/", headers=headers).json() == []


def test_csv_import_is_previewed_validated_and_never_partially_persists(client, db):
    company = _company(db, "IMPORT")
    headers = _headers(db, company, 1, "admin-import")
    invalid_csv = (
        "N Factura;Fecha;Cliente;Importe Total;Base;IVA;Cobrada\n"
        "FV/2025/0001;05/01/2025;Bosch;530,71;438,60;92,11;Pagada\n"
        "FV/2025/0002;06/01/2025;Error;96,80;80,00;16,80;Desconocida\n"
    ).encode()

    preview = client.post(
        "/api/v1/sales-ledger/manual-records/import/preview",
        headers=headers,
        files={"file": ("historico.csv", invalid_csv, "text/csv")},
    )
    assert preview.status_code == 200
    assert preview.json()["valid_rows"] == 1
    assert preview.json()["errors"][0]["row"] == 3

    rejected = client.post(
        "/api/v1/sales-ledger/manual-records/import",
        headers=headers,
        files={"file": ("historico.csv", invalid_csv, "text/csv")},
    )
    assert rejected.status_code == 422
    assert client.get("/api/v1/sales-ledger/", headers=headers).json() == []

    valid_csv = invalid_csv.replace(b"Desconocida", b"Pendiente")
    imported = client.post(
        "/api/v1/sales-ledger/manual-records/import",
        headers=headers,
        files={"file": ("historico.csv", valid_csv, "text/csv")},
    )
    assert imported.status_code == 201
    assert imported.json()["created_count"] == 2
    assert len(client.get("/api/v1/sales-ledger/", headers=headers).json()) == 2


def test_sales_ledger_rejects_viewers_and_spreadsheet_formula_numbers(client, db):
    company = _company(db, "SECURITY")
    viewer_headers = _headers(db, company, 3, "viewer-security")
    admin_headers = _headers(db, company, 1, "admin-security")

    assert client.get("/api/v1/sales-ledger/", headers=viewer_headers).status_code == 403
    blocked = client.post(
        "/api/v1/sales-ledger/manual-records",
        headers=admin_headers,
        json=_manual_payload(document_number="=CMD()"),
    )
    assert blocked.status_code == 422
