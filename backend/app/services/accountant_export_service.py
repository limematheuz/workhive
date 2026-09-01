import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord
from app.repositories import accountant_export as accountant_export_repo
from app.services.entitlement_service import require_company_feature
from app.services.reportable_sales_service import manual_records_without_workhive_invoice


MONEY_QUANTUM = Decimal("0.01")
INVOICE_HEADERS = (
    "Numero factura",
    "Fecha emision",
    "Fecha vencimiento",
    "Cliente",
    "NIF cliente",
    "Base imponible",
    "IVA",
    "Recargo equivalencia",
    "IRPF retenido",
    "Total factura",
    "Estado",
    "Fecha cobro",
    "Forma de pago",
    "Rectificativa",
)
EXPENSE_HEADERS = (
    "Fecha",
    "Proveedor",
    "Categoria",
    "Descripcion",
    "Base imponible",
    "IVA soportado",
    "Total",
    "Forma de pago",
    "Justificante adjunto",
)


@dataclass(frozen=True)
class AccountantExport:
    content: bytes
    filename: str
    invoice_count: int
    expense_count: int


@dataclass(frozen=True)
class AccountantExportPeriod:
    year: int
    kind: str
    number: int | None
    start: datetime
    end: datetime
    suffix: str
    label: str


def resolve_export_period(
    *,
    year: int,
    period: str,
    period_number: int | None,
) -> AccountantExportPeriod:
    if period == "year":
        if period_number is not None:
            raise ValueError("Annual exports do not accept a period number")
        return AccountantExportPeriod(
            year=year,
            kind=period,
            number=None,
            start=datetime(year, 1, 1, tzinfo=timezone.utc),
            end=datetime(year + 1, 1, 1, tzinfo=timezone.utc),
            suffix=str(year),
            label=str(year),
        )

    limits = {"month": 12, "quarter": 4, "semester": 2}
    limit = limits.get(period)
    if limit is None:
        raise ValueError("Unsupported accountant export period")
    if period_number is None or not 1 <= period_number <= limit:
        raise ValueError(f"{period.capitalize()} exports require a number from 1 to {limit}")

    if period == "month":
        start_month = period_number
        suffix = f"{year}-{period_number:02d}"
        label = f"{year}-{period_number:02d}"
        end_year = year + 1 if start_month == 12 else year
        end_month = 1 if start_month == 12 else start_month + 1
    elif period == "quarter":
        start_month = (period_number - 1) * 3 + 1
        suffix = f"{year}-T{period_number}"
        label = f"T{period_number} {year}"
        end_year = year + 1 if period_number == 4 else year
        end_month = 1 if period_number == 4 else start_month + 3
    else:
        start_month = (period_number - 1) * 6 + 1
        suffix = f"{year}-S{period_number}"
        label = f"S{period_number} {year}"
        end_year = year + 1 if period_number == 2 else year
        end_month = 1 if period_number == 2 else start_month + 6

    return AccountantExportPeriod(
        year=year,
        kind=period,
        number=period_number,
        start=datetime(year, start_month, 1, tzinfo=timezone.utc),
        end=datetime(end_year, end_month, 1, tzinfo=timezone.utc),
        suffix=suffix,
        label=label,
    )


def _money(value: Decimal | float | int | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _money_text(value: Decimal | float | int | None) -> str:
    return format(_money(value), ".2f").replace(".", ",")


def _date_text(value: datetime | None) -> str:
    return value.date().isoformat() if value else ""


def _safe_spreadsheet_text(value: object | None) -> str:
    text = str(value or "")
    return f"'{text}" if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text


def _csv_bytes(headers: tuple[str, ...], rows: list[dict[str, str]]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(
        stream, fieldnames=headers, delimiter=";", lineterminator="\n"
    )
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8-sig")


def _invoice_client_name(invoice: Invoice) -> str:
    snapshot = invoice.recipient_snapshot or {}
    return snapshot.get("name") or (
        invoice.client.name if invoice.client else "Cliente"
    )


def _invoice_tax_id(invoice: Invoice) -> str:
    snapshot = invoice.recipient_snapshot or {}
    return (
        snapshot.get("tax_id")
        or (invoice.client.legal_number if invoice.client else "")
        or ""
    )


def _invoice_row(invoice: Invoice) -> dict[str, str]:
    surcharge = _money(
        _money(invoice.base_amount) * _money(invoice.equivalence_surcharge) / 100
    )
    vat = _money(_money(invoice.tax_amount) - surcharge)
    retention = _money(_money(invoice.base_amount) * _money(invoice.retention) / 100)
    return {
        "Numero factura": _safe_spreadsheet_text(invoice.invoice_number),
        "Fecha emision": _date_text(invoice.issue_date),
        "Fecha vencimiento": _date_text(invoice.due_date),
        "Cliente": _safe_spreadsheet_text(_invoice_client_name(invoice)),
        "NIF cliente": _safe_spreadsheet_text(_invoice_tax_id(invoice)),
        "Base imponible": _money_text(invoice.base_amount),
        "IVA": _money_text(vat),
        "Recargo equivalencia": _money_text(surcharge),
        "IRPF retenido": _money_text(retention),
        "Total factura": _money_text(invoice.total_amount),
        "Estado": _safe_spreadsheet_text(invoice.status),
        "Fecha cobro": _date_text(invoice.paid_at),
        "Forma de pago": _safe_spreadsheet_text(invoice.payment_method),
        "Rectificativa": "Si" if invoice.is_rectification else "No",
    }


def _manual_sales_record_row(record: SalesLedgerRecord) -> dict[str, str]:
    """Use empty cells for fiscal attributes unavailable in imported history."""
    return {
        "Numero factura": _safe_spreadsheet_text(record.document_number),
        "Fecha emision": record.entry_date.isoformat(),
        "Fecha vencimiento": "",
        "Cliente": _safe_spreadsheet_text(record.client_name),
        "NIF cliente": "",
        "Base imponible": _money_text(record.base_amount),
        "IVA": _money_text(record.tax_amount),
        "Recargo equivalencia": _money_text(None),
        "IRPF retenido": _money_text(None),
        "Total factura": _money_text(record.total_amount),
        "Estado": "paid" if record.payment_status == "paid" else "issued",
        "Fecha cobro": "",
        "Forma de pago": "",
        "Rectificativa": "No",
    }


def _expense_row(expense: Expense) -> dict[str, str]:
    return {
        "Fecha": _date_text(expense.expense_date),
        "Proveedor": _safe_spreadsheet_text(expense.vendor),
        "Categoria": _safe_spreadsheet_text(expense.category),
        "Descripcion": _safe_spreadsheet_text(expense.description),
        "Base imponible": _money_text(expense.base_amount),
        "IVA soportado": _money_text(expense.tax_amount),
        "Total": _money_text(expense.total_amount),
        "Forma de pago": _safe_spreadsheet_text(expense.payment_method),
        "Justificante adjunto": "Si" if expense.receipt_url else "No",
    }


def _readme(period: AccountantExportPeriod, invoice_count: int, expense_count: int) -> bytes:
    return f"""PAQUETE PARA GESTORIA - {period.label}

Contenido:
- facturas_emitidas_{period.suffix}.csv: {invoice_count} facturas fiscales activas y asientos manuales no duplicados.
- gastos_registrados_{period.suffix}.csv: {expense_count} gastos activos.

Los CSV usan punto y coma como separador, UTF-8 y coma decimal para abrirse bien en Excel.
No incluye facturas en borrador ni canceladas. No incluye PDFs ni los archivos de justificantes: esos documentos siguen bajo el control de acceso de WorkHive.

Este paquete es un resumen operativo para la gestoria. Revise los datos antes de presentar cualquier declaracion tributaria.
""".encode("utf-8")


def build_accountant_export(
    db: Session, company_id: int, period: AccountantExportPeriod
) -> AccountantExport:
    require_company_feature(
        db,
        company_id=company_id,
        code="features.accountant_portal",
    )
    invoices = accountant_export_repo.list_reportable_invoices(
        db, company_id, start=period.start, end=period.end
    )
    manual_records = accountant_export_repo.list_active_manual_sales_records(
        db, company_id, start=period.start, end=period.end
    )
    manual_records = manual_records_without_workhive_invoice(invoices, manual_records)
    expenses = accountant_export_repo.list_active_expenses(
        db, company_id, start=period.start, end=period.end
    )

    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(
            f"facturas_emitidas_{period.suffix}.csv",
            _csv_bytes(
                INVOICE_HEADERS,
                [
                    *[_invoice_row(invoice) for invoice in invoices],
                    *[_manual_sales_record_row(record) for record in manual_records],
                ],
            ),
        )
        zip_file.writestr(
            f"gastos_registrados_{period.suffix}.csv",
            _csv_bytes(
                EXPENSE_HEADERS, [_expense_row(expense) for expense in expenses]
            ),
        )
        zip_file.writestr(
            "LEEME.txt",
            _readme(period, len(invoices) + len(manual_records), len(expenses)),
        )

    return AccountantExport(
        content=archive.getvalue(),
        filename=f"workhive-gestoria-{period.suffix}.zip",
        invoice_count=len(invoices) + len(manual_records),
        expense_count=len(expenses),
    )
