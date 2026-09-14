from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.margin_forecast import MarginForecast
from app.models.task_item import TaskItem
from app.models.work_order import WorkOrder
from app.models.work_session import WorkSession
from app.services.reportable_sales_service import REPORTABLE_INVOICE_STATUSES


def get_contract_forecast(
    db: Session, *, company_id: int, contract_id: int, for_update: bool = False
) -> MarginForecast | None:
    query = (
        db.query(MarginForecast)
        .filter(
            MarginForecast.company_id == company_id,
            MarginForecast.service_contract_id == contract_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def get_work_order_forecast(
    db: Session, *, company_id: int, work_order_id: int, for_update: bool = False
) -> MarginForecast | None:
    query = (
        db.query(MarginForecast)
        .filter(
            MarginForecast.company_id == company_id,
            MarginForecast.work_order_id == work_order_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def list_contract_work_order_ids(
    db: Session, *, company_id: int, contract_id: int
) -> list[int]:
    return [
        work_order_id
        for (work_order_id,) in db.query(WorkOrder.id)
        .filter(
            WorkOrder.company_id == company_id,
            WorkOrder.service_contract_id == contract_id,
        )
        .all()
    ]


def create_forecast(db: Session, **values) -> MarginForecast:
    forecast = MarginForecast(**values)
    db.add(forecast)
    db.flush()
    return forecast


def update_forecast(db: Session, forecast: MarginForecast, **values) -> MarginForecast:
    for key, value in values.items():
        setattr(forecast, key, value)
    db.add(forecast)
    db.flush()
    return forecast


def actual_totals_for_work_orders(
    db: Session,
    *,
    company_id: int,
    work_order_ids: Iterable[int],
) -> tuple[Decimal, Decimal, Decimal]:
    ids = tuple(sorted(set(work_order_ids)))
    if not ids:
        return Decimal("0"), Decimal("0"), Decimal("0")

    labor_cost = db.query(
        func.coalesce(func.sum(WorkSession.labor_cost_amount_snapshot), 0)
    ).join(
        TaskItem, TaskItem.id == WorkSession.task_item_id
    ).filter(
        WorkSession.labor_cost_company_id == company_id,
        WorkSession.end_time.is_not(None),
        WorkSession.labor_cost_amount_snapshot.is_not(None),
        TaskItem.company_id == company_id,
        TaskItem.work_order_id.in_(ids),
    ).scalar()

    reversed_issue_ids = select(InventoryMovement.reversal_of_movement_id).where(
        InventoryMovement.company_id == company_id,
        InventoryMovement.reversal_of_movement_id.is_not(None),
    )
    material_cost = db.query(
        func.coalesce(
            func.sum(InventoryMovement.quantity * InventoryMovement.unit_cost), 0
        )
    ).filter(
        InventoryMovement.company_id == company_id,
        InventoryMovement.movement_type == "issue",
        InventoryMovement.work_order_id.in_(ids),
        InventoryMovement.unit_cost.is_not(None),
        ~InventoryMovement.id.in_(reversed_issue_ids),
    ).scalar()

    revenue = db.query(
        func.coalesce(func.sum(InvoiceItem.subtotal), 0)
    ).join(
        Invoice, Invoice.id == InvoiceItem.invoice_id
    ).join(
        TaskItem, TaskItem.id == InvoiceItem.task_item_id
    ).filter(
        Invoice.company_id == company_id,
        Invoice.is_active.is_(True),
        Invoice.status.in_(REPORTABLE_INVOICE_STATUSES),
        TaskItem.company_id == company_id,
        TaskItem.work_order_id.in_(ids),
    ).scalar()

    return (
        Decimal(str(labor_cost or 0)),
        Decimal(str(material_cost or 0)),
        Decimal(str(revenue or 0)),
    )
