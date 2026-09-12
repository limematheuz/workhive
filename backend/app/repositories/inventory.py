"""Database queries for the company-scoped inventory ledger."""

from decimal import Decimal

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.inventory import (
    InventoryMaterial,
    InventoryMovement,
    InventorySupplier,
    InventoryWarehouse,
)
from app.models.inventory_lot import InventoryLot


def list_suppliers(db: Session, *, company_id: int) -> list[InventorySupplier]:
    return (
        db.query(InventorySupplier)
        .filter(
            InventorySupplier.company_id == company_id,
            InventorySupplier.is_active.is_(True),
        )
        .order_by(InventorySupplier.name.asc(), InventorySupplier.id.asc())
        .all()
    )


def get_supplier(
    db: Session, *, company_id: int, supplier_id: int
) -> InventorySupplier | None:
    return (
        db.query(InventorySupplier)
        .filter(
            InventorySupplier.id == supplier_id,
            InventorySupplier.company_id == company_id,
            InventorySupplier.is_active.is_(True),
        )
        .one_or_none()
    )


def create_supplier(db: Session, **values) -> InventorySupplier:
    supplier = InventorySupplier(**values)
    db.add(supplier)
    db.flush()
    return supplier


def list_materials(db: Session, *, company_id: int) -> list[InventoryMaterial]:
    return (
        db.query(InventoryMaterial)
        .filter(
            InventoryMaterial.company_id == company_id,
            InventoryMaterial.is_active.is_(True),
        )
        .order_by(InventoryMaterial.name.asc(), InventoryMaterial.id.asc())
        .all()
    )


def get_material(
    db: Session, *, company_id: int, material_id: int
) -> InventoryMaterial | None:
    return (
        db.query(InventoryMaterial)
        .filter(
            InventoryMaterial.id == material_id,
            InventoryMaterial.company_id == company_id,
            InventoryMaterial.is_active.is_(True),
        )
        .one_or_none()
    )


def create_material(db: Session, **values) -> InventoryMaterial:
    material = InventoryMaterial(**values)
    db.add(material)
    db.flush()
    return material


def list_warehouses(db: Session, *, company_id: int) -> list[InventoryWarehouse]:
    return (
        db.query(InventoryWarehouse)
        .filter(
            InventoryWarehouse.company_id == company_id,
            InventoryWarehouse.is_active.is_(True),
        )
        .order_by(InventoryWarehouse.name.asc(), InventoryWarehouse.id.asc())
        .all()
    )


def get_warehouse(
    db: Session, *, company_id: int, warehouse_id: int, for_update: bool = False
) -> InventoryWarehouse | None:
    query = db.query(InventoryWarehouse).filter(
        InventoryWarehouse.id == warehouse_id,
        InventoryWarehouse.company_id == company_id,
        InventoryWarehouse.is_active.is_(True),
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def create_warehouse(db: Session, **values) -> InventoryWarehouse:
    warehouse = InventoryWarehouse(**values)
    db.add(warehouse)
    db.flush()
    return warehouse


def get_lot(
    db: Session,
    *,
    company_id: int,
    lot_id: int,
    material_id: int | None = None,
    warehouse_id: int | None = None,
) -> InventoryLot | None:
    query = db.query(InventoryLot).filter(
        InventoryLot.id == lot_id,
        InventoryLot.company_id == company_id,
    )
    if material_id is not None:
        query = query.filter(InventoryLot.material_id == material_id)
    if warehouse_id is not None:
        query = query.filter(InventoryLot.warehouse_id == warehouse_id)
    return query.one_or_none()


def get_lot_by_code(
    db: Session,
    *,
    company_id: int,
    material_id: int,
    warehouse_id: int,
    code: str,
) -> InventoryLot | None:
    return (
        db.query(InventoryLot)
        .filter(
            InventoryLot.company_id == company_id,
            InventoryLot.material_id == material_id,
            InventoryLot.warehouse_id == warehouse_id,
            InventoryLot.code == code,
        )
        .one_or_none()
    )


def create_lot(db: Session, **values) -> InventoryLot:
    lot = InventoryLot(**values)
    db.add(lot)
    db.flush()
    return lot


def has_lots(
    db: Session, *, company_id: int, material_id: int, warehouse_id: int
) -> bool:
    return (
        db.query(InventoryLot.id)
        .filter(
            InventoryLot.company_id == company_id,
            InventoryLot.material_id == material_id,
            InventoryLot.warehouse_id == warehouse_id,
        )
        .first()
        is not None
    )


def available_quantity(
    db: Session, *, company_id: int, material_id: int, warehouse_id: int
) -> Decimal:
    signed_quantity = case(
        (
            InventoryMovement.movement_type.in_(("receipt", "adjustment_in")),
            InventoryMovement.quantity,
        ),
        else_=-InventoryMovement.quantity,
    )
    value = (
        db.query(func.coalesce(func.sum(signed_quantity), 0))
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.material_id == material_id,
            InventoryMovement.warehouse_id == warehouse_id,
        )
        .scalar()
    )
    return Decimal(str(value or 0))


def available_lot_quantity(
    db: Session,
    *,
    company_id: int,
    lot_id: int,
) -> Decimal:
    signed_quantity = case(
        (
            InventoryMovement.movement_type.in_(("receipt", "adjustment_in")),
            InventoryMovement.quantity,
        ),
        else_=-InventoryMovement.quantity,
    )
    value = (
        db.query(func.coalesce(func.sum(signed_quantity), 0))
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.lot_id == lot_id,
        )
        .scalar()
    )
    return Decimal(str(value or 0))


def create_movement(db: Session, **values) -> InventoryMovement:
    movement = InventoryMovement(**values)
    db.add(movement)
    db.flush()
    return movement


def list_movements(db: Session, *, company_id: int) -> list[InventoryMovement]:
    return (
        db.query(InventoryMovement)
        .filter(InventoryMovement.company_id == company_id)
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
        .all()
    )


def list_work_order_movements(
    db: Session, *, company_id: int, work_order_id: int
) -> list[InventoryMovement]:
    return (
        db.query(InventoryMovement)
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMovement.work_order_id == work_order_id,
        )
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
        .all()
    )


def get_work_order_movement(
    db: Session,
    *,
    company_id: int,
    work_order_id: int,
    movement_id: int,
    for_update: bool = False,
) -> InventoryMovement | None:
    query = db.query(InventoryMovement).filter(
        InventoryMovement.id == movement_id,
        InventoryMovement.company_id == company_id,
        InventoryMovement.work_order_id == work_order_id,
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def list_lot_balances(db: Session, *, company_id: int):
    signed_quantity = case(
        (
            InventoryMovement.movement_type.in_(("receipt", "adjustment_in")),
            InventoryMovement.quantity,
        ),
        else_=-InventoryMovement.quantity,
    )
    quantity = func.coalesce(func.sum(signed_quantity), 0).label("available_quantity")
    return (
        db.query(InventoryLot, InventoryMaterial, InventoryWarehouse, quantity)
        .join(InventoryMaterial, InventoryMaterial.id == InventoryLot.material_id)
        .join(InventoryWarehouse, InventoryWarehouse.id == InventoryLot.warehouse_id)
        .outerjoin(InventoryMovement, InventoryMovement.lot_id == InventoryLot.id)
        .filter(
            InventoryLot.company_id == company_id,
            InventoryMaterial.company_id == company_id,
            InventoryWarehouse.company_id == company_id,
        )
        .group_by(InventoryLot.id, InventoryMaterial.id, InventoryWarehouse.id)
        .order_by(
            InventoryLot.expires_at.asc().nullslast(),
            InventoryMaterial.name.asc(),
            InventoryLot.code.asc(),
        )
        .all()
    )


def list_stock_balances(db: Session, *, company_id: int):
    signed_quantity = case(
        (
            InventoryMovement.movement_type.in_(("receipt", "adjustment_in")),
            InventoryMovement.quantity,
        ),
        else_=-InventoryMovement.quantity,
    )
    quantity = func.coalesce(func.sum(signed_quantity), 0).label("available_quantity")
    return (
        db.query(
            InventoryMaterial,
            InventoryWarehouse,
            quantity,
        )
        .join(InventoryMovement, InventoryMovement.material_id == InventoryMaterial.id)
        .join(
            InventoryWarehouse, InventoryWarehouse.id == InventoryMovement.warehouse_id
        )
        .filter(
            InventoryMovement.company_id == company_id,
            InventoryMaterial.company_id == company_id,
            InventoryWarehouse.company_id == company_id,
            InventoryMaterial.is_active.is_(True),
            InventoryWarehouse.is_active.is_(True),
        )
        .group_by(
            InventoryMaterial.id,
            InventoryWarehouse.id,
        )
        .order_by(InventoryMaterial.name.asc(), InventoryWarehouse.name.asc())
        .all()
    )
