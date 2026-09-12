"""Persistence queries for purchases linked to stock and fiscal expenses."""

from sqlalchemy.orm import Session, selectinload

from app.models.inventory_purchase import InventoryPurchase, InventoryPurchaseLine


def _with_details(query):
    return query.options(
        selectinload(InventoryPurchase.expense),
        selectinload(InventoryPurchase.lines).selectinload(InventoryPurchaseLine.lot),
    )


def list_purchases(db: Session, *, company_id: int) -> list[InventoryPurchase]:
    return (
        _with_details(
            db.query(InventoryPurchase).filter(InventoryPurchase.company_id == company_id)
        )
        .order_by(InventoryPurchase.received_at.desc(), InventoryPurchase.id.desc())
        .all()
    )


def get_purchase(
    db: Session,
    *,
    company_id: int,
    purchase_id: int,
    for_update: bool = False,
) -> InventoryPurchase | None:
    query = _with_details(
        db.query(InventoryPurchase).filter(
            InventoryPurchase.id == purchase_id,
            InventoryPurchase.company_id == company_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def get_purchase_by_expense(
    db: Session, *, company_id: int, expense_id: int
) -> InventoryPurchase | None:
    return (
        db.query(InventoryPurchase)
        .filter(
            InventoryPurchase.company_id == company_id,
            InventoryPurchase.expense_id == expense_id,
        )
        .one_or_none()
    )


def create_purchase(db: Session, **values) -> InventoryPurchase:
    purchase = InventoryPurchase(**values)
    db.add(purchase)
    db.flush()
    return purchase


def create_purchase_line(db: Session, **values) -> InventoryPurchaseLine:
    line = InventoryPurchaseLine(**values)
    db.add(line)
    db.flush()
    return line
