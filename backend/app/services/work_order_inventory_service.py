"""Immutable material consumption linked to operational work orders."""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement
from app.models.user import User
from app.repositories import inventory as inventory_repo
from app.repositories import work_order as work_order_repo
from app.schemas.inventory import (
    InventoryWorkOrderConsumptionCreate,
    InventoryWorkOrderConsumptionReversal,
)
from app.services import location_access_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


INVENTORY_READ = "inventory.read"
INVENTORY_MANAGE = "inventory.manage"
WORK_READ = "work.read"
WORK_MANAGE = "work.manage"
CONSUMABLE_WORK_ORDER_STATUSES = frozenset({"active", "paused"})


def _company_id(db: Session, current_user: User, *, inventory: str, work: str) -> int:
    require_capability(db, current_user, inventory)
    require_capability(db, current_user, work)
    company_id = require_company_context(current_user)
    require_company_feature(db, company_id=company_id, code="features.work_orders")
    return company_id


def _work_order_or_404(
    db: Session,
    current_user: User,
    *,
    company_id: int,
    work_order_id: int,
    permission_code: str,
):
    work_order = work_order_repo.get_work_order(
        db, company_id=company_id, work_order_id=work_order_id
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    location_access_service.require_location_capability(
        db,
        current_user,
        work_order.location_id,
        "can_manage_tasks",
        permission_code=permission_code,
    )
    return work_order


def _movement_reference(work_order_id: int, title: str, *, correction: bool = False) -> str:
    prefix = "Corrección de consumo" if correction else "Consumo"
    return f"{prefix} · Orden #{work_order_id} · {title}"[:160]


def _commit(db: Session, movement_id: int):
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar el consumo por un conflicto de datos",
        ) from error
    movement = db.get(InventoryMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento no encontrado")
    return movement


def list_consumptions(db: Session, current_user: User, work_order_id: int):
    company_id = _company_id(
        db, current_user, inventory=INVENTORY_READ, work=WORK_READ
    )
    _work_order_or_404(
        db,
        current_user,
        company_id=company_id,
        work_order_id=work_order_id,
        permission_code=WORK_READ,
    )
    return inventory_repo.list_work_order_movements(
        db, company_id=company_id, work_order_id=work_order_id
    )


def create_consumption(
    db: Session,
    current_user: User,
    work_order_id: int,
    payload: InventoryWorkOrderConsumptionCreate,
):
    company_id = _company_id(
        db, current_user, inventory=INVENTORY_MANAGE, work=WORK_MANAGE
    )
    work_order = _work_order_or_404(
        db,
        current_user,
        company_id=company_id,
        work_order_id=work_order_id,
        permission_code=WORK_MANAGE,
    )
    if work_order.status not in CONSUMABLE_WORK_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La orden no admite consumos en su estado actual",
            headers={"X-WorkHive-Error-Code": "inventory.work_order_not_consumable"},
        )
    material = inventory_repo.get_material(
        db, company_id=company_id, material_id=payload.material_id
    )
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material no encontrado")
    warehouse = inventory_repo.get_warehouse(
        db,
        company_id=company_id,
        warehouse_id=payload.warehouse_id,
        for_update=True,
    )
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Almacén no encontrado")
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
    elif inventory_repo.has_lots(
        db,
        company_id=company_id,
        material_id=material.id,
        warehouse_id=warehouse.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selecciona el lote para registrar el consumo de este material",
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
            detail="No hay stock suficiente para registrar el consumo",
            headers={"X-WorkHive-Error-Code": "inventory.insufficient_stock"},
        )
    movement = inventory_repo.create_movement(
        db,
        company_id=company_id,
        material_id=material.id,
        warehouse_id=warehouse.id,
        lot_id=lot.id if lot else None,
        work_order_id=work_order.id,
        movement_type="issue",
        quantity=payload.quantity,
        unit_cost=None,
        reference=_movement_reference(work_order.id, work_order.title),
        notes=payload.notes,
        recorded_by_user_id=current_user.id,
    )
    return _commit(db, movement.id)


def reverse_consumption(
    db: Session,
    current_user: User,
    work_order_id: int,
    movement_id: int,
    payload: InventoryWorkOrderConsumptionReversal,
):
    company_id = _company_id(
        db, current_user, inventory=INVENTORY_MANAGE, work=WORK_MANAGE
    )
    work_order = _work_order_or_404(
        db,
        current_user,
        company_id=company_id,
        work_order_id=work_order_id,
        permission_code=WORK_MANAGE,
    )
    movement = inventory_repo.get_work_order_movement(
        db,
        company_id=company_id,
        work_order_id=work_order.id,
        movement_id=movement_id,
        for_update=True,
    )
    if movement is None or movement.movement_type != "issue":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumo no encontrado")
    if movement.reversal_of_movement_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un movimiento de corrección no puede corregirse de nuevo",
        )
    existing_reversal = (
        db.query(InventoryMovement.id)
        .filter(InventoryMovement.reversal_of_movement_id == movement.id)
        .first()
    )
    if existing_reversal is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El consumo ya fue corregido",
        )
    reversal = inventory_repo.create_movement(
        db,
        company_id=company_id,
        material_id=movement.material_id,
        warehouse_id=movement.warehouse_id,
        lot_id=movement.lot_id,
        work_order_id=work_order.id,
        reversal_of_movement_id=movement.id,
        movement_type="adjustment_in",
        quantity=movement.quantity,
        unit_cost=movement.unit_cost,
        reference=_movement_reference(work_order.id, work_order.title, correction=True),
        notes=payload.reason,
        recorded_by_user_id=current_user.id,
    )
    return _commit(db, reversal.id)
