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
        name=f"Profitability {suffix}",
        tax_id=f"PROFIT-{suffix}",
        address="Calle Rentabilidad 1",
        phone="600000000",
        email=f"profitability-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _headers(db, company: Company, role_id: int, suffix: str) -> dict[str, str]:
    user = User(
        email=f"{suffix}@profitability.test",
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


def _client(db, company: Company, name: str) -> Client:
    client = Client(
        company_id=company.id,
        name=name,
        address="Calle Cliente 2",
        city="Girona",
        postal_code="17001",
        country="España",
        email=f"{name.casefold().replace(' ', '-')}@example.test",
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
    issue_date: datetime,
    status: str,
    base: str,
) -> None:
    base_amount = Decimal(base)
    db.add(
        Invoice(
            company_id=company.id,
            client_id=client.id,
            invoice_number=number,
            issue_date=issue_date,
            status=status,
            base_amount=base_amount,
            tax_amount=base_amount * Decimal("0.21"),
            total_amount=base_amount * Decimal("1.21"),
        )
    )


def _expense(
    db,
    company: Company,
    *,
    expense_date: datetime,
    base: float,
    client_id: int | None = None,
    is_active: bool = True,
) -> None:
    db.add(
        Expense(
            company_id=company.id,
            client_id=client_id,
            expense_date=expense_date,
            category="operations",
            description="Coste directo" if client_id else "Coste general",
            base_amount=base,
            tax_amount=0.0,
            total_amount=base,
            is_active=is_active,
        )
    )


def test_client_profitability_uses_reportable_invoices_and_direct_costs_only(client, db):
    company = _company(db, "PRIMARY")
    headers = _headers(db, company, 1, "admin-primary")
    alpha = _client(db, company, "Alpha")
    beta = _client(db, company, "Beta")

    _invoice(
        db,
        company,
        alpha,
        number="INV-ALPHA",
        issue_date=datetime(2026, 8, 4, tzinfo=timezone.utc),
        status="issued",
        base="100.00",
    )
    _invoice(
        db,
        company,
        beta,
        number="INV-BETA",
        issue_date=datetime(2026, 8, 8, tzinfo=timezone.utc),
        status="paid",
        base="50.00",
    )
    _invoice(
        db,
        company,
        alpha,
        number="INV-DRAFT",
        issue_date=datetime(2026, 8, 10, tzinfo=timezone.utc),
        status="draft",
        base="999.00",
    )
    _invoice(
        db,
        company,
        alpha,
        number="INV-PREVIOUS",
        issue_date=datetime(2026, 7, 10, tzinfo=timezone.utc),
        status="issued",
        base="20.00",
    )
    _expense(
        db,
        company,
        client_id=alpha.id,
        expense_date=datetime(2026, 8, 3, tzinfo=timezone.utc),
        base=40.0,
    )
    _expense(
        db,
        company,
        client_id=beta.id,
        expense_date=datetime(2026, 8, 3, tzinfo=timezone.utc),
        base=10.0,
    )
    _expense(
        db,
        company,
        expense_date=datetime(2026, 8, 3, tzinfo=timezone.utc),
        base=20.0,
    )
    _expense(
        db,
        company,
        client_id=alpha.id,
        expense_date=datetime(2026, 8, 3, tzinfo=timezone.utc),
        base=999.0,
        is_active=False,
    )
    _expense(
        db,
        company,
        client_id=alpha.id,
        expense_date=datetime(2026, 7, 3, tzinfo=timezone.utc),
        base=5.0,
    )
    db.add_all(
        [
            SalesLedgerRecord(
                company_id=company.id,
                document_number="HIST-001",
                entry_date=date(2026, 8, 6),
                client_name="Cliente histórico",
                base_amount=Decimal("30.00"),
                tax_amount=Decimal("6.30"),
                total_amount=Decimal("36.30"),
                payment_status="paid",
            ),
            SalesLedgerRecord(
                company_id=company.id,
                document_number=" inv-alpha ",
                entry_date=date(2026, 8, 6),
                client_name="No duplicar factura real",
                base_amount=Decimal("20.00"),
                tax_amount=Decimal("4.20"),
                total_amount=Decimal("24.20"),
                payment_status="paid",
            ),
        ]
    )
    db.commit()

    response = client.get(
        "/api/v1/client-profitability/?period=month&reference_date=2026-08-20",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period"] == "month"
    assert payload["reference_date"] == "2026-08-20"
    assert payload["current"] == {
        "revenue_base_amount": "150.00",
        "direct_cost_base_amount": "50.00",
        "known_margin_amount": "100.00",
        "known_margin_percentage": "66.67",
        "client_count": 2,
        "unassigned_expense_base_amount": "20.00",
        "unlinked_historical_sales_base_amount": "30.00",
        "clients": [
            {
                "client_id": alpha.id,
                "client_name": "Alpha",
                "invoice_count": 1,
                "direct_cost_count": 1,
                "revenue_base_amount": "100.00",
                "direct_cost_base_amount": "40.00",
                "known_margin_amount": "60.00",
                "known_margin_percentage": "60.00",
            },
            {
                "client_id": beta.id,
                "client_name": "Beta",
                "invoice_count": 1,
                "direct_cost_count": 1,
                "revenue_base_amount": "50.00",
                "direct_cost_base_amount": "10.00",
                "known_margin_amount": "40.00",
                "known_margin_percentage": "80.00",
            },
        ],
    }
    assert payload["previous"] == {
        "revenue_base_amount": "20.00",
        "direct_cost_base_amount": "5.00",
        "known_margin_amount": "15.00",
        "known_margin_percentage": "75.00",
        "client_count": 1,
        "unassigned_expense_base_amount": "0.00",
        "unlinked_historical_sales_base_amount": "0.00",
        "clients": [
            {
                "client_id": alpha.id,
                "client_name": "Alpha",
                "invoice_count": 1,
                "direct_cost_count": 1,
                "revenue_base_amount": "20.00",
                "direct_cost_base_amount": "5.00",
                "known_margin_amount": "15.00",
                "known_margin_percentage": "75.00",
            },
        ],
    }


def test_client_profitability_year_comparison_is_tenant_scoped_and_admin_only(client, db):
    company = _company(db, "PRIMARY-SECURITY")
    other_company = _company(db, "OTHER-SECURITY")
    admin_headers = _headers(db, company, 1, "admin-security")
    viewer_headers = _headers(db, company, 3, "viewer-security")
    own_client = _client(db, company, "Cliente propio")
    other_client = _client(db, other_company, "Cliente ajeno")
    _invoice(
        db,
        company,
        own_client,
        number="INV-OWN",
        issue_date=datetime(2026, 1, 10, tzinfo=timezone.utc),
        status="issued",
        base="100.00",
    )
    _invoice(
        db,
        other_company,
        other_client,
        number="INV-OTHER",
        issue_date=datetime(2026, 1, 10, tzinfo=timezone.utc),
        status="issued",
        base="500.00",
    )
    db.commit()

    denied = client.get(
        "/api/v1/client-profitability/?period=year&reference_date=2026-08-20",
        headers=viewer_headers,
    )
    assert denied.status_code == 403

    response = client.get(
        "/api/v1/client-profitability/?period=year&reference_date=2026-08-20",
        headers=admin_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["period"] == "year"
    assert payload["current"]["revenue_base_amount"] == "100.00"
    assert payload["current"]["client_count"] == 1
    assert payload["previous"]["revenue_base_amount"] == "0.00"


def test_expense_client_assignment_rejects_foreign_clients_and_can_be_removed(client, db):
    company = _company(db, "EXPENSES")
    other_company = _company(db, "EXPENSES-OTHER")
    headers = _headers(db, company, 1, "expense-admin")
    own_client = _client(db, company, "Cliente propio")
    foreign_client = _client(db, other_company, "Cliente ajeno")
    db.commit()
    payload = {
        "expense_date": "2026-08-10T00:00:00Z",
        "client_id": own_client.id,
        "category": "supplies",
        "description": "Material asignado",
        "base_amount": 30,
        "tax_amount": 6.3,
    }

    created = client.post("/api/v1/expenses/", headers=headers, json=payload)
    assert created.status_code == 201
    assert created.json()["client_id"] == own_client.id
    assert created.json()["total_amount"] == 36.3

    listed = client.get("/api/v1/expenses/", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == created.json()["id"]
    assert listed.json()[0]["client_id"] == own_client.id

    rejected = client.post(
        "/api/v1/expenses/",
        headers=headers,
        json={**payload, "client_id": foreign_client.id},
    )
    assert rejected.status_code == 404

    cleared = client.patch(
        f"/api/v1/expenses/{created.json()['id']}",
        headers=headers,
        json={"client_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["client_id"] is None
