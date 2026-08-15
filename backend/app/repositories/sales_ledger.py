from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord


def get_manual_records(db: Session, company_id: int) -> list[SalesLedgerRecord]:
    return (
        db.query(SalesLedgerRecord)
        .filter(
            SalesLedgerRecord.company_id == company_id,
            SalesLedgerRecord.is_active.is_(True),
        )
        .order_by(SalesLedgerRecord.entry_date.desc(), SalesLedgerRecord.id.desc())
        .all()
    )


def get_manual_record(
    db: Session,
    company_id: int,
    record_id: int,
) -> SalesLedgerRecord | None:
    return (
        db.query(SalesLedgerRecord)
        .filter(
            SalesLedgerRecord.id == record_id,
            SalesLedgerRecord.company_id == company_id,
            SalesLedgerRecord.is_active.is_(True),
        )
        .first()
    )


def get_active_manual_record_by_number(
    db: Session,
    company_id: int,
    document_number: str,
) -> SalesLedgerRecord | None:
    return (
        db.query(SalesLedgerRecord)
        .filter(
            SalesLedgerRecord.company_id == company_id,
            SalesLedgerRecord.document_number == document_number,
            SalesLedgerRecord.is_active.is_(True),
        )
        .first()
    )


def invoice_number_exists(db: Session, company_id: int, document_number: str) -> bool:
    return (
        db.query(Invoice.id)
        .filter(
            Invoice.company_id == company_id,
            Invoice.invoice_number == document_number,
            Invoice.is_active.is_(True),
        )
        .first()
        is not None
    )


def create_manual_record(
    db: Session,
    *,
    company_id: int,
    created_by_user_id: int,
    **data,
) -> SalesLedgerRecord:
    record = SalesLedgerRecord(
        company_id=company_id,
        created_by_user_id=created_by_user_id,
        **data,
    )
    db.add(record)
    return record


def soft_delete_manual_record(db: Session, record: SalesLedgerRecord) -> None:
    record.is_active = False
    db.add(record)
