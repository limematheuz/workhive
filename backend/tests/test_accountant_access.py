import csv
import io
import zipfile
from datetime import datetime, timezone
from decimal import Decimal

from app.core.security import create_access_token, get_password_hash
from app.models.client import Client
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.expense import Expense
from app.models.external_access_grant import ExternalAccessGrant
from app.models.invoice import Invoice
from app.models.role import Role
from app.models.user import User
from tests.credentials import TEST_SECRET, login_form


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Gestoria {suffix}",
        tax_id=f"GESTORIA-{suffix}",
        address="Calle Gestoria 1",
        phone="600000000",
        email=f"gestoria-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _headers(db, company: Company, role_id: int, suffix: str) -> tuple[User, dict[str, str]]:
    user = User(
        email=f"{suffix}@gestoria.example.com",
        hashed_password="unused",
        full_name=suffix,
        role_id=role_id,
        company_id=company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return user, {"Authorization": f"Bearer {token}"}


def _client(db, company: Company, suffix: str) -> Client:
    client = Client(
        company_id=company.id,
        name=f"Cliente {suffix}",
        address="Calle Cliente 1",
        city="Girona",
        postal_code="17001",
        country="España",
    )
    db.add(client)
    db.flush()
    return client


def _csv_rows(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    return list(
        csv.DictReader(
            io.TextIOWrapper(archive.open(name), encoding="utf-8-sig"),
            delimiter=";",
        )
    )


def test_external_accountant_has_read_only_finance_access_and_monthly_exports(client, db):
    external_portal_role = db.query(Role).filter(Role.name == "external_portal").one()

    company = _company(db, "PRIMARY")
    other_company = _company(db, "OTHER")
    accountant, headers = _headers(
        db,
        company,
        external_portal_role.id,
        "external-accountant",
    )
    db.add(
        ExternalAccessGrant(
            company_id=company.id,
            user_id=accountant.id,
            access_type="accountant",
            status="active",
        )
    )
    db.commit()
    assert (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company.id,
            CompanyMembership.user_id == accountant.id,
        )
        .count()
        == 0
    )
    identity = client.get("/api/v1/users/me", headers=headers)
    assert identity.status_code == 200, identity.text
    assert identity.json()["can_view_finance"] is True
    assert identity.json()["can_manage_finance"] is False
    own_client = _client(db, company, "principal")
    other_client = _client(db, other_company, "otra")
    db.add_all(
        [
            Invoice(
                company_id=company.id,
                client_id=own_client.id,
                invoice_number="INV-2026-02",
                issue_date=datetime(2026, 2, 10, tzinfo=timezone.utc),
                status="issued",
                base_amount=Decimal("100.00"),
                tax_amount=Decimal("21.00"),
                total_amount=Decimal("121.00"),
            ),
            Invoice(
                company_id=company.id,
                client_id=own_client.id,
                invoice_number="INV-2026-03",
                issue_date=datetime(2026, 3, 10, tzinfo=timezone.utc),
                status="issued",
                base_amount=Decimal("200.00"),
                tax_amount=Decimal("42.00"),
                total_amount=Decimal("242.00"),
            ),
            Invoice(
                company_id=other_company.id,
                client_id=other_client.id,
                invoice_number="INV-OTHER-02",
                issue_date=datetime(2026, 2, 10, tzinfo=timezone.utc),
                status="issued",
                base_amount=Decimal("300.00"),
                tax_amount=Decimal("63.00"),
                total_amount=Decimal("363.00"),
            ),
            Expense(
                company_id=company.id,
                expense_date=datetime(2026, 2, 12, tzinfo=timezone.utc),
                vendor="Proveedor febrero",
                category="supplies",
                description="Material",
                base_amount=Decimal("40.00"),
                tax_amount=Decimal("8.40"),
                total_amount=Decimal("48.40"),
            ),
        ]
    )
    db.commit()

    assert client.get("/api/v1/invoices/", headers=headers).status_code == 200
    assert client.get("/api/v1/expenses/", headers=headers).status_code == 200
    assert client.get("/api/v1/sales-ledger/", headers=headers).status_code == 200
    assert client.get("/api/v1/fiscal-summary/?year=2026", headers=headers).status_code == 200

    export = client.get(
        "/api/v1/accounting-exports/accountant?year=2026&period=month&period_number=2",
        headers=headers,
    )
    assert export.status_code == 200
    assert "workhive-gestoria-2026-02.zip" in export.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(export.content)) as archive:
        invoices = _csv_rows(archive, "facturas_emitidas_2026-02.csv")
        expenses = _csv_rows(archive, "gastos_registrados_2026-02.csv")
    assert [row["Numero factura"] for row in invoices] == ["INV-2026-02"]
    assert [row["Proveedor"] for row in expenses] == ["Proveedor febrero"]

    assert client.post(
        "/api/v1/expenses/",
        headers=headers,
        json={
            "expense_date": "2026-02-12T00:00:00Z",
            "category": "supplies",
            "description": "No permitido",
            "base_amount": "1.00",
            "tax_amount": "0.21",
            "total_amount": "1.21",
        },
    ).status_code == 403
    assert client.post(
        "/api/v1/sales-ledger/manual-records",
        headers=headers,
        json={
            "document_number": "MANUAL-2026-01",
            "entry_date": "2026-02-12",
            "client_name": "No permitido",
            "base_amount": "1.00",
            "tax_amount": "0.21",
            "payment_status": "paid",
        },
    ).status_code == 403
    assert client.get("/api/v1/task-items/", headers=headers).status_code == 403

    internal_user = User(
        email="internal-user@gestoria.test",
        hashed_password="unused",
        full_name="Internal user",
        role_id=3,
        company_id=company.id,
    )
    db.add(internal_user)
    db.commit()
    assert client.patch(
        f"/api/v1/users/{internal_user.id}",
        headers=headers,
        json={"full_name": "Attempted edit"},
    ).status_code == 403

    grant = db.query(ExternalAccessGrant).filter_by(user_id=accountant.id).one()
    grant.status = "revoked"
    db.commit()
    assert client.get("/api/v1/invoices/", headers=headers).status_code == 403


def test_company_admin_can_suspend_and_restore_an_external_accountant(client, db):
    external_portal_role = db.query(Role).filter(Role.name == "external_portal").one()
    company = _company(db, "SUSPEND")
    admin, admin_headers = _headers(db, company, 1, "external-access-admin")
    accountant, accountant_headers = _headers(
        db,
        company,
        external_portal_role.id,
        "suspendable-accountant",
    )
    accountant.hashed_password = get_password_hash(TEST_SECRET)
    grant = ExternalAccessGrant(
        company_id=company.id,
        user_id=accountant.id,
        access_type="accountant",
        status="active",
    )
    db.add(grant)
    db.commit()

    suspended = client.patch(
        f"/api/v1/users/{accountant.id}",
        headers=admin_headers,
        json={"is_active": False},
    )

    assert suspended.status_code == 200, suspended.text
    db.refresh(grant)
    assert grant.status == "revoked"
    assert grant.revoked_by_user_id == admin.id
    assert grant.revoked_at is not None

    restored = client.patch(
        f"/api/v1/users/{accountant.id}",
        headers=admin_headers,
        json={"is_active": True},
    )

    assert restored.status_code == 200, restored.text
    db.refresh(grant)
    assert grant.status == "active"
    assert grant.revoked_at is None
    assert grant.revoked_by_user_id is None
    assert client.get("/api/v1/invoices/", headers=accountant_headers).status_code == 401
    login = client.post("/api/v1/auth/login", data=login_form(accountant.email))
    assert login.status_code == 200, login.text
    assert client.get("/api/v1/invoices/").status_code == 200
