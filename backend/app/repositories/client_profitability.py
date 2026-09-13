from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.orm import Session, selectinload

from app.models.client import Client
from app.models.expense import Expense
from app.models.inventory import InventoryMovement
from app.models.inventory_purchase import InventoryPurchase
from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord
from app.services.reportable_sales_service import REPORTABLE_INVOICE_STATUSES


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


def list_expenses(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> list[Expense]:
    return (
        db.query(Expense)
        .options(selectinload(Expense.client))
        .outerjoin(InventoryPurchase, InventoryPurchase.expense_id == Expense.id)
        .filter(
            Expense.company_id == company_id,
            Expense.is_active.is_(True),
            # The fiscal purchase is recognized by Finance, but its cost only
            # enters a client margin when stock is actually consumed.
            InventoryPurchase.id.is_(None),
            Expense.expense_date >= start,
            Expense.expense_date < end,
        )
        .order_by(Expense.expense_date.asc(), Expense.id.asc())
        .all()
    )


def list_unreversed_material_consumptions(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> list[tuple[InventoryMovement, Client | None]]:
    reversed_issue_ids = select(InventoryMovement.reversal_of_movement_id).where(
        InventoryMovement.company_id == company_id,
        InventoryMovement.reversal_of_movement_id.is_not(None),
    )
    return (
        db.query(InventoryMovement, Client)
        .outerjoin(
            Client,
            and_(
                Client.id == InventoryMovement.client_id,
                Client.company_id == company_id,
            ),
        )
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.movement_type == "issue",
            InventoryMovement.work_order_id.is_not(None),
            InventoryMovement.unit_cost.is_not(None),
            InventoryMovement.created_at >= start,
            InventoryMovement.created_at < end,
            ~InventoryMovement.id.in_(reversed_issue_ids),
        )
        .order_by(InventoryMovement.created_at.asc(), InventoryMovement.id.asc())
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
