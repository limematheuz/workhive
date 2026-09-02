import csv
import io
import zipfile
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
        name=f"Export {suffix}",
        tax_id=f"EXPORT-{suffix}",
        address="Calle Exportacion 1",
        phone="600000000",
        email=f"export-{suffix}@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _headers(db, company: Company, role_id: int, suffix: str) -> dict[str, str]:
    user = User(
        email=f"{suffix}@export.test",
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


def _read_csv(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    return list(
        csv.DictReader(
            io.TextIOWrapper(archive.open(name), encoding="utf-8-sig"),
            delimiter=";",
        )
    )


def test_accountant_export_contains_only_reportable_tenant_documents_and_safe_csv_cells(
    client, db
):
    company = _company(db, "PRIMARY")
    other_company = _company(db, "OTHER")
    headers = _headers(db, company, 1, "admin-primary")
    client_record = Client(
        company_id=company.id,
        name="Cliente exportable",
        legal_number="B12345678",
        address="Calle Cliente 2",
        city="Girona",
        postal_code="17001",
        country="España",
    )
    db.add(client_record)
    db.flush()
    db.add_all(
        [
            Invoice(
                company_id=company.id,
                client_id=client_record.id,
                invoice_number="INV-2026-0001",
                issue_date=datetime(2026, 2, 3, tzinfo=timezone.utc),
                due_date=datetime(2026, 2, 18, tzinfo=timezone.utc),
                status="issued",
                base_amount=Decimal("100.00"),
                tax_amount=Decimal("26.20"),
                total_amount=Decimal("126.20"),
                equivalence_surcharge=Decimal("5.20"),
                retention=Decimal("7.00"),
                payment_method="transfer",
                recipient_snapshot={"name": "=Cliente formula", "tax_id": "B12345678"},
            ),
            Invoice(
                company_id=company.id,
                client_id=client_record.id,
                invoice_number="DRAFT-2026-0001",
                issue_date=datetime(2026, 2, 4, tzinfo=timezone.utc),
                status="draft",
                base_amount=Decimal("90.00"),
                tax_amount=Decimal("18.90"),
                total_amount=Decimal("108.90"),
            ),
        ]
    )
    db.add_all(
        [
            Expense(
                company_id=company.id,
                expense_date=datetime(2026, 2, 5, tzinfo=timezone.utc),
                vendor="+Proveedor formula",
                category="supplies",
                description="@Material de limpieza",
                payment_method="card",
                base_amount=50,
                tax_amount=10.5,
                total_amount=60.5,
                receipt_url="/media/receipt.pdf",
            ),
            Expense(
                company_id=company.id,
                expense_date=datetime(2026, 2, 6, tzinfo=timezone.utc),
                vendor="No exportar",
                category="supplies",
                description="Inactivo",
                base_amount=20,
                tax_amount=4.2,
                total_amount=24.2,
                is_active=False,
            ),
            Expense(
                company_id=other_company.id,
                expense_date=datetime(2026, 2, 7, tzinfo=timezone.utc),
                vendor="Otra empresa",
                category="supplies",
                description="Aislado",
                base_amount=30,
                tax_amount=6.3,
                total_amount=36.3,
            ),
        ]
    )
    db.commit()

    response = client.get(
        "/api/v1/accounting-exports/accountant?year=2026", headers=headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    assert "workhive-gestoria-2026.zip" in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert sorted(archive.namelist()) == [
            "LEEME.txt",
            "facturas_emitidas_2026.csv",
            "gastos_registrados_2026.csv",
        ]
        invoices = _read_csv(archive, "facturas_emitidas_2026.csv")
        expenses = _read_csv(archive, "gastos_registrados_2026.csv")
        readme = archive.read("LEEME.txt").decode()

    assert invoices == [
        {
            "Numero factura": "INV-2026-0001",
            "Fecha emision": "2026-02-03",
            "Fecha vencimiento": "2026-02-18",
            "Cliente": "'=Cliente formula",
            "NIF cliente": "B12345678",
            "Base imponible": "100,00",
            "IVA": "21,00",
            "Recargo equivalencia": "5,20",
            "IRPF retenido": "7,00",
            "Total factura": "126,20",
            "Estado": "issued",
            "Fecha cobro": "",
            "Forma de pago": "transfer",
            "Rectificativa": "No",
        }
    ]
    assert expenses == [
        {
            "Fecha": "2026-02-05",
            "Proveedor": "'+Proveedor formula",
            "Categoria": "supplies",
            "Descripcion": "'@Material de limpieza",
            "Base imponible": "50,00",
            "IVA soportado": "10,50",
            "Total": "60,50",
            "Forma de pago": "card",
            "Justificante adjunto": "Si",
        }
    ]
    assert "No incluye facturas en borrador ni canceladas" in readme


def test_accountant_export_requires_company_admin_and_valid_year(client, db):
    company = _company(db, "SECURITY")
    viewer_headers = _headers(db, company, 3, "viewer-security")

    assert (
        client.get(
            "/api/v1/accounting-exports/accountant?year=2026",
            headers=viewer_headers,
        ).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/accounting-exports/accountant?year=1999",
            headers=_headers(db, company, 1, "admin-security"),
        ).status_code
        == 422
    )


def test_accountant_export_requires_the_accountant_portal_plan_feature(client, db):
    company = _company(db, "BASIC-PLAN")
    company.subscription_plan = "basic"
    db.add(company)
    db.commit()

    response = client.get(
        "/api/v1/accounting-exports/accountant?year=2026",
        headers=_headers(db, company, 1, "basic-plan-admin"),
    )

    assert response.status_code == 403
    assert response.headers["X-WorkHive-Error-Code"] == "entitlement.feature_not_in_plan"


def test_accountant_export_includes_manual_history_once_and_preserves_real_invoices(
    client, db
):
    company = _company(db, "MANUAL-HISTORY")
    headers = _headers(db, company, 1, "admin-manual-history")
    client_record = Client(
        company_id=company.id,
        name="Cliente factura real",
        address="Calle Cliente 2",
        city="Girona",
        postal_code="17001",
        country="España",
    )
    db.add(client_record)
    db.flush()
    db.add(
        Invoice(
            company_id=company.id,
            client_id=client_record.id,
            invoice_number="INV-2026-SHARED",
            issue_date=datetime(2026, 6, 1, tzinfo=timezone.utc),
            status="issued",
            base_amount=Decimal("100.00"),
            tax_amount=Decimal("21.00"),
            total_amount=Decimal("121.00"),
        )
    )
    db.add_all(
        [
            SalesLedgerRecord(
                company_id=company.id,
                document_number="HIST-2026-0001",
                entry_date=date(2026, 6, 2),
                client_name="=Cliente histórico",
                base_amount=Decimal("50.00"),
                tax_amount=Decimal("10.50"),
                total_amount=Decimal("60.50"),
                payment_status="paid",
            ),
            SalesLedgerRecord(
                company_id=company.id,
                document_number=" inv-2026-shared ",
                entry_date=date(2026, 6, 3),
                client_name="Duplicado legado",
                base_amount=Decimal("999.00"),
                tax_amount=Decimal("209.79"),
                total_amount=Decimal("1208.79"),
                payment_status="pending",
            ),
        ]
    )
    db.commit()

    response = client.get(
        "/api/v1/accounting-exports/accountant?year=2026", headers=headers
    )

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        invoices = _read_csv(archive, "facturas_emitidas_2026.csv")
        readme = archive.read("LEEME.txt").decode()

    assert [row["Numero factura"] for row in invoices] == [
        "INV-2026-SHARED",
        "HIST-2026-0001",
    ]
    assert invoices[1]["Cliente"] == "'=Cliente histórico"
    assert invoices[1]["Estado"] == "paid"
    assert invoices[1]["IRPF retenido"] == "0,00"
    assert "2 facturas fiscales activas y asientos manuales no duplicados" in readme
