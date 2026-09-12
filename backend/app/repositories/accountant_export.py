from datetime import datetime

from sqlalchemy.orm import Session, selectinload

from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord


REPORTABLE_INVOICE_STATUSES = (
    "issued",
    "partially_paid",
    "paid",
    "overdue",
    "rectified",
)


def list_reportable_invoices(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> list[Invoice]:
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.client))
        .filter(
            Invoice.company_id == company_id,
            Invoice.is_active.is_(True),
            Invoice.status.in_(REPORTABLE_INVOICE_STATUSES),
            Invoice.issue_date >= start,
            Invoice.issue_date < end,
        )
        .order_by(Invoice.issue_date.asc(), Invoice.id.asc())
        .all()
    )


def list_active_expenses(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> list[Expense]:
    return (
        db.query(Expense)
        .filter(
            Expense.company_id == company_id,
            Expense.is_active.is_(True),
            Expense.expense_date >= start,
            Expense.expense_date < end,
        )
        .order_by(Expense.expense_date.asc(), Expense.id.asc())
        .all()
    )


def list_active_manual_sales_records(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> list[SalesLedgerRecord]:
    return (
        db.query(SalesLedgerRecord)
        .filter(
            SalesLedgerRecord.company_id == company_id,
            SalesLedgerRecord.is_active.is_(True),
            SalesLedgerRecord.entry_date >= start.date(),
            SalesLedgerRecord.entry_date < end.date(),
        )
        .order_by(SalesLedgerRecord.entry_date.asc(), SalesLedgerRecord.id.asc())
        .all()
    )
