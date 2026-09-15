from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement
from app.models.inventory_purchase import InventoryPurchase
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.margin_forecast import MarginForecast
from app.models.service_catalog_version import ServiceCatalogVersion
from app.models.template_task import TemplateTask
from app.models.expense import Expense
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


def list_service_margin_scopes(
    db: Session, *, company_id: int
) -> list[ServiceCatalogVersion]:
    """List immutable service revisions owned by one company."""
    return (
        db.query(ServiceCatalogVersion)
        .join(TemplateTask, TemplateTask.id == ServiceCatalogVersion.template_task_id)
        .filter(TemplateTask.company_id == company_id)
        .order_by(ServiceCatalogVersion.name.asc(), ServiceCatalogVersion.version.desc())
        .all()
    )


def get_service_margin_scope(
    db: Session, *, company_id: int, service_catalog_version_id: int
) -> ServiceCatalogVersion | None:
    return (
        db.query(ServiceCatalogVersion)
        .join(TemplateTask, TemplateTask.id == ServiceCatalogVersion.template_task_id)
        .filter(
            TemplateTask.company_id == company_id,
            ServiceCatalogVersion.id == service_catalog_version_id,
        )
        .one_or_none()
    )


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
    service_contract_id: int | None = None,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    ids = tuple(sorted(set(work_order_ids)))
    if not ids and service_contract_id is None:
        return Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")

    labor_cost = db.query(
        func.coalesce(func.sum(WorkSession.labor_cost_amount_snapshot), 0)
    ).join(
        TaskItem, TaskItem.id == WorkSession.task_item_id
    ).filter(
        WorkSession.labor_cost_company_id == company_id,
        WorkSession.end_time.is_not(None),
        WorkSession.labor_cost_amount_snapshot.is_not(None),
        TaskItem.company_id == company_id,
        TaskItem.work_order_id.in_(ids) if ids else False,
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
        InventoryMovement.work_order_id.in_(ids) if ids else False,
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
        TaskItem.work_order_id.in_(ids) if ids else False,
    ).scalar()

    expense_scope_filters = []
    if service_contract_id is not None:
        expense_scope_filters.append(Expense.service_contract_id == service_contract_id)
    if ids:
        expense_scope_filters.append(Expense.work_order_id.in_(ids))
    direct_expense_cost = db.query(
        func.coalesce(func.sum(Expense.base_amount), 0)
    ).outerjoin(
        InventoryPurchase, InventoryPurchase.expense_id == Expense.id
    ).filter(
        Expense.company_id == company_id,
        Expense.is_active.is_(True),
        InventoryPurchase.id.is_(None),
        or_(*expense_scope_filters),
    ).scalar()

    return (
        Decimal(str(labor_cost or 0)),
        Decimal(str(material_cost or 0)),
        Decimal(str(revenue or 0)),
        Decimal(str(direct_expense_cost or 0)),
    )


def actual_totals_for_location(
    db: Session, *, company_id: int, location_id: int
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Return only actual amounts that have an unambiguous location link.

    Contract-level expenses are deliberately excluded: a contract may cover
    several locations and this query must never manufacture a split. Inventory
    uses the issuing work order because movements do not carry a location
    snapshot of their own.
    """
    labor_cost = db.query(
        func.coalesce(func.sum(WorkSession.labor_cost_amount_snapshot), 0)
    ).filter(
        WorkSession.labor_cost_company_id == company_id,
        WorkSession.location_id == location_id,
        WorkSession.end_time.is_not(None),
        WorkSession.labor_cost_amount_snapshot.is_not(None),
    ).scalar()

    reversed_issue_ids = select(InventoryMovement.reversal_of_movement_id).where(
        InventoryMovement.company_id == company_id,
        InventoryMovement.reversal_of_movement_id.is_not(None),
    )
    material_cost = db.query(
        func.coalesce(
            func.sum(InventoryMovement.quantity * InventoryMovement.unit_cost), 0
        )
    ).join(WorkOrder, WorkOrder.id == InventoryMovement.work_order_id).filter(
        InventoryMovement.company_id == company_id,
        InventoryMovement.movement_type == "issue",
        InventoryMovement.unit_cost.is_not(None),
        WorkOrder.company_id == company_id,
        WorkOrder.location_id == location_id,
        ~InventoryMovement.id.in_(reversed_issue_ids),
    ).scalar()

    revenue = db.query(
        func.coalesce(func.sum(InvoiceItem.subtotal), 0)
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).join(
        TaskItem, TaskItem.id == InvoiceItem.task_item_id
    ).filter(
        Invoice.company_id == company_id,
        Invoice.is_active.is_(True),
        Invoice.status.in_(REPORTABLE_INVOICE_STATUSES),
        TaskItem.company_id == company_id,
        TaskItem.location_id == location_id,
    ).scalar()

    direct_expense_cost = db.query(
        func.coalesce(func.sum(Expense.base_amount), 0)
    ).join(WorkOrder, WorkOrder.id == Expense.work_order_id).outerjoin(
        InventoryPurchase, InventoryPurchase.expense_id == Expense.id
    ).filter(
        Expense.company_id == company_id,
        Expense.is_active.is_(True),
        InventoryPurchase.id.is_(None),
        WorkOrder.company_id == company_id,
        WorkOrder.location_id == location_id,
    ).scalar()

    return (
        Decimal(str(labor_cost or 0)),
        Decimal(str(material_cost or 0)),
        Decimal(str(revenue or 0)),
        Decimal(str(direct_expense_cost or 0)),
    )


def known_totals_for_service(
    db: Session, *, company_id: int, service_catalog_version_id: int
) -> tuple[Decimal, Decimal]:
    """Return the exact revenue and labour traced to one service revision.

    Inventory movements and expenses currently point at an order or contract,
    not at an individual task/service. They are intentionally excluded here:
    guessing their split would make a service margin unreliable.
    """
    labor_cost = db.query(
        func.coalesce(func.sum(WorkSession.labor_cost_amount_snapshot), 0)
    ).join(TaskItem, TaskItem.id == WorkSession.task_item_id).filter(
        WorkSession.labor_cost_company_id == company_id,
        WorkSession.end_time.is_not(None),
        WorkSession.labor_cost_amount_snapshot.is_not(None),
        TaskItem.company_id == company_id,
        TaskItem.service_catalog_version_id == service_catalog_version_id,
    ).scalar()

    revenue = db.query(
        func.coalesce(func.sum(InvoiceItem.subtotal), 0)
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).join(
        TaskItem, TaskItem.id == InvoiceItem.task_item_id
    ).filter(
        Invoice.company_id == company_id,
        Invoice.is_active.is_(True),
        Invoice.status.in_(REPORTABLE_INVOICE_STATUSES),
        TaskItem.company_id == company_id,
        TaskItem.service_catalog_version_id == service_catalog_version_id,
    ).scalar()

    return Decimal(str(labor_cost or 0)), Decimal(str(revenue or 0))
