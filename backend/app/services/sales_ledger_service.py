import csv
import io
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord
from app.repositories import invoice as invoice_repo
from app.repositories import sales_ledger as sales_ledger_repo
from app.schemas.sales_ledger import (
    SalesLedgerCsvError,
    SalesLedgerCsvPreview,
    SalesLedgerEntryResponse,
    SalesLedgerManualRecordCreate,
    SalesLedgerManualRecordUpdate,
)


REPORTABLE_INVOICE_STATUSES = {
    "issued",
    "partially_paid",
    "paid",
    "overdue",
    "rectified",
}
SALES_LEDGER_CSV_HEADERS = (
    "N Factura",
    "Fecha",
    "Cliente",
    "Importe Total",
    "Base",
    "IVA",
    "Cobrada",
)
MAX_CSV_BYTES = 512 * 1024
MAX_CSV_ROWS = 500
MONEY_QUANTUM = Decimal("0.01")


@dataclass(frozen=True)
class ParsedSalesLedgerCsv:
    rows: list[SalesLedgerManualRecordCreate]
    errors: list[SalesLedgerCsvError]


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _calculate_total(base_amount: Decimal, tax_amount: Decimal) -> Decimal:
    return _money(base_amount + tax_amount)


def _payment_status_for_invoice(invoice: Invoice) -> str:
    return "paid" if invoice.status == "paid" or invoice.paid_at else "pending"


def _invoice_client_name(invoice: Invoice) -> str:
    snapshot = invoice.recipient_snapshot or {}
    return snapshot.get("name") or (invoice.client.name if invoice.client else "Cliente")


def _to_invoice_entry(invoice: Invoice) -> SalesLedgerEntryResponse:
    return SalesLedgerEntryResponse(
        source_type="invoice",
        source_id=invoice.id,
        document_number=invoice.invoice_number,
        entry_date=invoice.issue_date.date(),
        client_name=_invoice_client_name(invoice),
        base_amount=invoice.base_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        payment_status=_payment_status_for_invoice(invoice),
        is_editable=False,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
    )


def _to_manual_entry(record: SalesLedgerRecord) -> SalesLedgerEntryResponse:
    return SalesLedgerEntryResponse(
        source_type="manual",
        source_id=record.id,
        document_number=record.document_number,
        entry_date=record.entry_date,
        client_name=record.client_name,
        base_amount=record.base_amount,
        tax_amount=record.tax_amount,
        total_amount=record.total_amount,
        payment_status=record.payment_status,
        is_editable=True,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_entries(
    db: Session,
    company_id: int,
    *,
    year: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[SalesLedgerEntryResponse]:
    invoices = [
        invoice
        for invoice in invoice_repo.get_invoices(db, company_id, skip=0, limit=500)
        if invoice.status in REPORTABLE_INVOICE_STATUSES
    ]
    entries = [_to_invoice_entry(invoice) for invoice in invoices]
    entries.extend(_to_manual_entry(record) for record in sales_ledger_repo.get_manual_records(db, company_id))

    if year is not None:
        entries = [entry for entry in entries if entry.entry_date.year == year]
    if search:
        normalized_search = search.strip().casefold()
        entries = [
            entry
            for entry in entries
            if normalized_search in entry.document_number.casefold()
            or normalized_search in entry.client_name.casefold()
        ]
    entries.sort(key=lambda entry: (entry.entry_date, entry.source_id), reverse=True)
    return entries[skip : skip + limit]


def _get_manual_record_or_404(
    db: Session,
    company_id: int,
    record_id: int,
) -> SalesLedgerRecord:
    record = sales_ledger_repo.get_manual_record(db, company_id, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales ledger record not found")
    return record


def _ensure_available_document_number(
    db: Session,
    company_id: int,
    document_number: str,
    *,
    current_record_id: int | None = None,
) -> None:
    existing = sales_ledger_repo.get_active_manual_record_by_number(
        db,
        company_id,
        document_number,
    )
    if existing and existing.id != current_record_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A manual sales record already uses this invoice number",
        )
    if sales_ledger_repo.invoice_number_exists(db, company_id, document_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An issued WorkHive invoice already uses this invoice number",
        )


def create_manual_record(
    db: Session,
    company_id: int,
    created_by_user_id: int,
    data: SalesLedgerManualRecordCreate,
) -> SalesLedgerEntryResponse:
    payload = data.model_dump()
    _ensure_available_document_number(db, company_id, payload["document_number"])
    payload["total_amount"] = _calculate_total(payload["base_amount"], payload["tax_amount"])
    record = sales_ledger_repo.create_manual_record(
        db,
        company_id=company_id,
        created_by_user_id=created_by_user_id,
        **payload,
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A manual sales record already uses this invoice number",
        ) from error
    db.refresh(record)
    return _to_manual_entry(record)


def update_manual_record(
    db: Session,
    company_id: int,
    record_id: int,
    data: SalesLedgerManualRecordUpdate,
) -> SalesLedgerEntryResponse:
    record = _get_manual_record_or_404(db, company_id, record_id)
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No changes provided")
    document_number = payload.get("document_number", record.document_number)
    _ensure_available_document_number(
        db,
        company_id,
        document_number,
        current_record_id=record.id,
    )
    base_amount = payload.get("base_amount", record.base_amount)
    tax_amount = payload.get("tax_amount", record.tax_amount)
    payload["total_amount"] = _calculate_total(base_amount, tax_amount)
    for field, value in payload.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return _to_manual_entry(record)


def delete_manual_record(db: Session, company_id: int, record_id: int) -> None:
    record = _get_manual_record_or_404(db, company_id, record_id)
    sales_ledger_repo.soft_delete_manual_record(db, record)
    db.commit()


def _parse_csv_money(value: str) -> Decimal:
    normalized = value.strip().replace(".", "").replace(",", ".")
    try:
        amount = Decimal(normalized)
    except InvalidOperation as error:
        raise ValueError("must be a valid amount") from error
    if amount < 0:
        raise ValueError("cannot be negative")
    return _money(amount)


def _parse_csv_payment_status(value: str) -> str:
    normalized = value.strip().casefold()
    mapping = {"pagada": "paid", "paid": "paid", "pendiente": "pending", "pending": "pending"}
    if normalized not in mapping:
        raise ValueError("Cobrada must be Pagada or Pendiente")
    return mapping[normalized]


def parse_csv(contents: bytes) -> ParsedSalesLedgerCsv:
    if len(contents) > MAX_CSV_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="CSV file is too large")
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="CSV must use UTF-8 encoding") from error
    reader = csv.DictReader(io.StringIO(decoded), delimiter=";")
    if tuple(reader.fieldnames or ()) != SALES_LEDGER_CSV_HEADERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="CSV headers do not match the WorkHive sales ledger template",
        )

    rows: list[SalesLedgerManualRecordCreate] = []
    errors: list[SalesLedgerCsvError] = []
    for row_number, raw_row in enumerate(reader, start=2):
        if row_number > MAX_CSV_ROWS + 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="CSV exceeds 500 rows")
        try:
            base_amount = _parse_csv_money(raw_row["Base"] or "")
            tax_amount = _parse_csv_money(raw_row["IVA"] or "")
            total_amount = _parse_csv_money(raw_row["Importe Total"] or "")
            expected_total = _calculate_total(base_amount, tax_amount)
            if total_amount != expected_total:
                raise ValueError("Importe Total must equal Base plus IVA")
            rows.append(
                SalesLedgerManualRecordCreate(
                    document_number=raw_row["N Factura"] or "",
                    entry_date=datetime.strptime(raw_row["Fecha"] or "", "%d/%m/%Y").date(),
                    client_name=raw_row["Cliente"] or "",
                    base_amount=base_amount,
                    tax_amount=tax_amount,
                    payment_status=_parse_csv_payment_status(raw_row["Cobrada"] or ""),
                )
            )
        except (ValueError, KeyError) as error:
            errors.append(SalesLedgerCsvError(row=row_number, message=str(error)))
    return ParsedSalesLedgerCsv(rows=rows, errors=errors)


def preview_csv(contents: bytes) -> SalesLedgerCsvPreview:
    parsed = parse_csv(contents)
    return SalesLedgerCsvPreview(valid_rows=len(parsed.rows), errors=parsed.errors)


def import_csv(
    db: Session,
    company_id: int,
    created_by_user_id: int,
    contents: bytes,
) -> int:
    parsed = parse_csv(contents)
    if parsed.errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": "CSV contains invalid rows", "errors": [error.model_dump() for error in parsed.errors]},
        )
    document_numbers = [record.document_number for record in parsed.rows]
    if len(document_numbers) != len(set(document_numbers)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CSV contains duplicate invoice numbers")
    for record in parsed.rows:
        _ensure_available_document_number(db, company_id, record.document_number)
    try:
        for record in parsed.rows:
            payload = record.model_dump()
            sales_ledger_repo.create_manual_record(
                db,
                company_id=company_id,
                created_by_user_id=created_by_user_id,
                total_amount=_calculate_total(payload.pop("base_amount"), payload.pop("tax_amount")),
                base_amount=record.base_amount,
                tax_amount=record.tax_amount,
                **payload,
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A sales ledger record already exists") from error
    return len(parsed.rows)
