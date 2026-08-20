from datetime import date, datetime, timezone
from decimal import Decimal

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord
from app.models.user import User


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Fiscal summary {suffix}",
        tax_id=f"FISCAL-{suffix}",
        address="Calle Fiscal 1",
        phone="600000000",
        email=f"fiscal-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _headers(db, company: Company, role_id: int, suffix: str) -> dict[str, str]:
    user = User(
        email=f"{suffix}@fiscal-summary.test",
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


def _client(db, company: Company) -> Client:
    client = Client(
        company_id=company.id,
        name="Cliente fiscal",
        address="Calle Cliente 2",
        city="Girona",
        postal_code="17001",
        country="España",
        email="client@example.test",
    )
    db.add(client)
    db.flush()
    return client


def _invoice(
    db,
    company: Company,
    client: Client,
    *,
    number: str,
    month: int,
    status: str,
    base: str,
    tax: str,
    surcharge: str = "0",
    retention: str = "0",
) -> None:
    db.add(
        Invoice(
            company_id=company.id,
            client_id=client.id,
            invoice_number=number,
            issue_date=datetime(2026, month, 15, tzinfo=timezone.utc),
            status=status,
            base_amount=Decimal(base),
            tax_amount=Decimal(tax),
            total_amount=Decimal(base) + Decimal(tax),
            equivalence_surcharge=Decimal(surcharge),
            retention=Decimal(retention),
        )
    )


def test_fiscal_summary_uses_issued_documents_and_registered_expenses(client, db):
    company = _company(db, "PRIMARY")
    headers = _headers(db, company, 1, "admin-primary")
    fiscal_client = _client(db, company)
    _invoice(
        db,
        company,
        fiscal_client,
        number="INV-2026-0001",
        month=2,
        status="paid",
        base="100.00",
        tax="26.00",
        surcharge="5.00",
        retention="15.00",
    )
    _invoice(
        db,
        company,
        fiscal_client,
        number="INV-2026-0002",
        month=5,
        status="issued",
        base="200.00",
        tax="42.00",
    )
    _invoice(
        db,
        company,
        fiscal_client,
        number="INV-2026-DRAFT",
        month=5,
        status="draft",
        base="999.00",
        tax="209.79",
    )
    _invoice(
        db,
        company,
        fiscal_client,
        number="R-2026-0001",
        month=8,
        status="rectified",
        base="-50.00",
        tax="-10.50",
    )
    _invoice(
        db,
        company,
        fiscal_client,
        number="INV-2026-CANCELLED",
        month=11,
        status="cancelled",
        base="500.00",
        tax="105.00",
    )
    db.add_all(
        [
            Expense(
                company_id=company.id,
                expense_date=datetime(2026, 3, 10, tzinfo=timezone.utc),
                category="supplies",
                description="Material",
                base_amount=50.0,
                tax_amount=10.0,
                total_amount=60.0,
            ),
            Expense(
                company_id=company.id,
                expense_date=datetime(2026, 6, 10, tzinfo=timezone.utc),
                category="supplies",
                description="Archivado",
                base_amount=100.0,
                tax_amount=21.0,
                total_amount=121.0,
                is_active=False,
            ),
        ]
    )
    db.commit()

    response = client.get("/api/v1/fiscal-summary/?year=2026", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["year"] == 2026
    assert [period["label"] for period in payload["periods"]] == ["T1", "T2", "T3", "T4"]
    assert payload["periods"][0] == {
        "key": "Q1",
        "label": "T1",
        "issued_invoice_count": 1,
        "registered_expense_count": 1,
        "output_base_amount": "100.00",
        "output_vat_amount": "21.00",
        "equivalence_surcharge_amount": "5.00",
        "registered_expense_base_amount": "50.00",
        "registered_input_vat_amount": "10.00",
        "estimated_vat_balance": "11.00",
        "withheld_irpf_amount": "15.00",
    }
    assert payload["periods"][1]["output_vat_amount"] == "42.00"
    assert payload["periods"][2]["output_base_amount"] == "-50.00"
    assert payload["annual"] == {
        "key": "annual",
        "label": "2026",
        "issued_invoice_count": 3,
        "registered_expense_count": 1,
        "output_base_amount": "250.00",
        "output_vat_amount": "52.50",
        "equivalence_surcharge_amount": "5.00",
        "registered_expense_base_amount": "50.00",
        "registered_input_vat_amount": "10.00",
        "estimated_vat_balance": "42.50",
        "withheld_irpf_amount": "15.00",
    }


def test_fiscal_summary_is_tenant_scoped_and_admin_only(client, db):
    company = _company(db, "PRIMARY-SECURITY")
    other_company = _company(db, "OTHER-SECURITY")
    admin_headers = _headers(db, company, 1, "admin-security")
    viewer_headers = _headers(db, company, 3, "viewer-security")
    other_client = _client(db, other_company)
    _invoice(
        db,
        other_company,
        other_client,
        number="INV-2026-OTHER",
        month=1,
        status="issued",
        base="500.00",
        tax="105.00",
    )
    db.commit()

    denied = client.get("/api/v1/fiscal-summary/?year=2026", headers=viewer_headers)
    assert denied.status_code == 403

    own_summary = client.get("/api/v1/fiscal-summary/?year=2026", headers=admin_headers)
    assert own_summary.status_code == 200
    assert own_summary.json()["annual"]["issued_invoice_count"] == 0
    assert own_summary.json()["annual"]["output_vat_amount"] == "0.00"


def test_fiscal_summary_includes_manual_history_without_duplicating_workhive_invoices(
    client, db
):
    company = _company(db, "MANUAL-HISTORY")
    headers = _headers(db, company, 1, "admin-manual-history")
    fiscal_client = _client(db, company)
    _invoice(
        db,
        company,
        fiscal_client,
        number="INV-2026-SHARED",
        month=5,
        status="issued",
        base="100.00",
        tax="21.00",
    )
    db.add_all(
        [
            SalesLedgerRecord(
                company_id=company.id,
                document_number="HIST-2026-0001",
                entry_date=date(2026, 5, 10),
                client_name="Cliente histórico",
                base_amount=Decimal("50.00"),
                tax_amount=Decimal("10.50"),
                total_amount=Decimal("60.50"),
                payment_status="paid",
            ),
            # Defensive legacy case: an old CSV record can differ only in case
            # and whitespace even though a real invoice is now authoritative.
            SalesLedgerRecord(
                company_id=company.id,
                document_number=" inv-2026-shared ",
                entry_date=date(2026, 5, 11),
                client_name="No duplicar",
                base_amount=Decimal("999.00"),
                tax_amount=Decimal("209.79"),
                total_amount=Decimal("1208.79"),
                payment_status="pending",
            ),
        ]
    )
    db.commit()

    response = client.get("/api/v1/fiscal-summary/?year=2026", headers=headers)

    assert response.status_code == 200
    may = response.json()["periods"][1]
    assert may["issued_invoice_count"] == 2
    assert may["output_base_amount"] == "150.00"
    assert may["output_vat_amount"] == "31.50"
    assert response.json()["annual"]["withheld_irpf_amount"] == "0.00"


def test_fiscal_summary_rejects_invalid_year(client, db):
    company = _company(db, "YEAR")
    headers = _headers(db, company, 1, "admin-year")

    response = client.get("/api/v1/fiscal-summary/?year=1999", headers=headers)

    assert response.status_code == 422
