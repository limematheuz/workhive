from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate


def _lock_numbering(db: Session, company_id: int, year: int, series: str) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        lock_key = f"{company_id}:{year}:{series}"
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": lock_key},
        )


def generate_invoice_number(
    db: Session,
    company_id: int,
    *,
    series: str = "INV",
    issue_date: datetime | None = None,
) -> str:
    year = (issue_date or datetime.now()).year
    _lock_numbering(db, company_id, year, series)
    prefix = f"{series}-{year}-"

    numbers = (
        db.query(Invoice.invoice_number)
        .filter(
            Invoice.company_id == company_id,
            Invoice.invoice_number.like(f"{prefix}%"),
        )
        .all()
    )
    last_sequence = 0
    for (number,) in numbers:
        try:
            last_sequence = max(last_sequence, int(number.removeprefix(prefix)))
        except ValueError:
            continue
    return f"{prefix}{last_sequence + 1:04d}"


def generate_rectification_number(
    db: Session, company_id: int, issue_date: datetime | None = None
) -> str:
    return generate_invoice_number(
        db, company_id, series="R", issue_date=issue_date
    )


def get_invoices(
    db: Session,
    company_id: int,
    client_id: int | None = None,
    invoice_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Invoice]:
    query = db.query(Invoice).filter(Invoice.company_id == company_id)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if invoice_status:
        query = query.filter(Invoice.status == invoice_status)
    return (
        query.order_by(Invoice.issue_date.desc(), Invoice.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_invoice(db: Session, company_id: int, invoice_id: int) -> Invoice | None:
    return (
        db.query(Invoice)
        .filter(Invoice.company_id == company_id, Invoice.id == invoice_id)
        .first()
    )


def create_invoice(
    db: Session,
    company_id: int,
    invoice_data: InvoiceCreate,
    *,
    draft_number: str,
) -> Invoice:
    payload = invoice_data.model_dump(exclude={"invoice_number"})
    requested_number = (invoice_data.invoice_number or "").strip()
    db_invoice = Invoice(
        **payload,
        company_id=company_id,
        invoice_number=requested_number or draft_number,
        status="draft",
    )
    db.add(db_invoice)
    db.flush()
    return db_invoice


def update_invoice(
    db: Session, db_invoice: Invoice, invoice_data: InvoiceUpdate
) -> Invoice:
    for key, value in invoice_data.model_dump(exclude_unset=True).items():
        setattr(db_invoice, key, value)
    db.add(db_invoice)
    db.flush()
    return db_invoice
