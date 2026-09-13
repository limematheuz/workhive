"""Business rules for the first company inventory slice."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import inventory as inventory_repo
from app.schemas.inventory import (
    InventoryMaterialCreate,
    InventoryMovementCreate,
    InventorySupplierCreate,
    InventoryWarehouseCreate,
)
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


INVENTORY_READ = "inventory.read"
INVENTORY_MANAGE = "inventory.manage"
OUTGOING_MOVEMENT_TYPES = frozenset({"issue", "adjustment_out"})


def _company_id(db: Session, current_user: User, capability: str) -> int:
    require_capability(db, current_user, capability)
    return require_company_context(current_user)


def _commit(db: Session, entity):
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un registro de inventario con esos datos",
        ) from error
    db.refresh(entity)
    return entity


def list_suppliers(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    return inventory_repo.list_suppliers(db, company_id=company_id)


def create_supplier(db: Session, current_user: User, payload: InventorySupplierCreate):
    company_id = _company_id(db, current_user, INVENTORY_MANAGE)
    supplier = inventory_repo.create_supplier(
        db, company_id=company_id, **payload.model_dump()
    )
    return _commit(db, supplier)


def list_materials(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    return inventory_repo.list_materials(db, company_id=company_id)


def create_material(db: Session, current_user: User, payload: InventoryMaterialCreate):
    company_id = _company_id(db, current_user, INVENTORY_MANAGE)
    if (
        payload.supplier_id is not None
        and inventory_repo.get_supplier(
            db, company_id=company_id, supplier_id=payload.supplier_id
        )
        is None
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado"
        )
    material = inventory_repo.create_material(
        db, company_id=company_id, **payload.model_dump()
    )
    return _commit(db, material)


def list_warehouses(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    return inventory_repo.list_warehouses(db, company_id=company_id)


def create_warehouse(
    db: Session, current_user: User, payload: InventoryWarehouseCreate
):
    company_id = _company_id(db, current_user, INVENTORY_MANAGE)
    warehouse = inventory_repo.create_warehouse(
        db, company_id=company_id, **payload.model_dump()
    )
    return _commit(db, warehouse)


def list_movements(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    return inventory_repo.list_movements(db, company_id=company_id)


def list_lot_balances(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    return [
        {
            "id": lot.id,
            "material_id": material.id,
            "material_sku": material.sku,
            "material_name": material.name,
            "warehouse_id": warehouse.id,
            "warehouse_name": warehouse.name,
            "code": lot.code,
            "expires_at": lot.expires_at,
            "available_quantity": available_quantity,
            "created_at": lot.created_at,
        }
        for lot, material, warehouse, available_quantity in inventory_repo.list_lot_balances(
            db, company_id=company_id
        )
    ]


def create_movement(db: Session, current_user: User, payload: InventoryMovementCreate):
    company_id = _company_id(db, current_user, INVENTORY_MANAGE)
    material = inventory_repo.get_material(
        db, company_id=company_id, material_id=payload.material_id
    )
    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Material no encontrado"
        )
    warehouse = inventory_repo.get_warehouse(
        db,
        company_id=company_id,
        warehouse_id=payload.warehouse_id,
        for_update=True,
    )
    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Almacén no encontrado"
        )
    lot = None
    if payload.lot_id is not None:
        lot = inventory_repo.get_lot(
            db,
            company_id=company_id,
            lot_id=payload.lot_id,
            material_id=material.id,
            warehouse_id=warehouse.id,
        )
        if lot is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")
    if payload.movement_type in OUTGOING_MOVEMENT_TYPES:
        if lot is None and inventory_repo.has_lots(
            db,
            company_id=company_id,
            material_id=material.id,
            warehouse_id=warehouse.id,
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Selecciona el lote para registrar una salida de este material",
                headers={"X-WorkHive-Error-Code": "inventory.lot_required"},
            )
        available = (
            inventory_repo.available_lot_quantity(
                db, company_id=company_id, lot_id=lot.id
            )
            if lot is not None
            else inventory_repo.available_quantity(
                db,
                company_id=company_id,
                material_id=material.id,
                warehouse_id=warehouse.id,
            )
        )
        if available < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay stock suficiente para registrar la salida",
                headers={"X-WorkHive-Error-Code": "inventory.insufficient_stock"},
            )
    movement = inventory_repo.create_movement(
        db,
        company_id=company_id,
        recorded_by_user_id=current_user.id,
        **payload.model_dump(),
    )
    return _commit(db, movement)


def list_stock_balances(db: Session, current_user: User):
    company_id = _company_id(db, current_user, INVENTORY_READ)
    balances = []
    for material, warehouse, quantity in inventory_repo.list_stock_balances(
        db, company_id=company_id
    ):
        available = Decimal(str(quantity))
        balances.append(
            {
                "material_id": material.id,
                "material_sku": material.sku,
                "material_name": material.name,
                "unit": material.unit,
                "warehouse_id": warehouse.id,
                "warehouse_name": warehouse.name,
                "available_quantity": available,
                "reorder_point": material.reorder_point,
                "is_below_reorder_point": available < material.reorder_point,
            }
        )
    return balances
