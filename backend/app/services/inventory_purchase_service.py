"""Atomic purchase workflow: one fiscal expense plus immutable stock receipts."""

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import expense as expense_repo
from app.repositories import inventory as inventory_repo
from app.repositories import inventory_purchase as purchase_repo
from app.schemas.inventory_purchase import (
    InventoryPurchaseCreate,
    InventoryPurchaseReversal,
)
from app.services import client_service
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


INVENTORY_READ = "inventory.read"
INVENTORY_MANAGE = "inventory.manage"
FINANCE_READ = "finance.read"
FINANCE_MANAGE = "finance.manage"
MONEY_QUANTUM = Decimal("0.01")


def _company_id(
    db: Session,
    current_user: User,
    *,
    inventory_capability: str,
    finance_capability: str,
) -> int:
    require_capability(db, current_user, inventory_capability)
    require_capability(db, current_user, finance_capability)
    return require_company_context(current_user)


def _expense_base_amount(payload: InventoryPurchaseCreate) -> Decimal:
    return sum(
        (line.quantity * line.unit_cost for line in payload.lines), Decimal("0")
    ).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _get_purchase_or_404(
    db: Session, *, company_id: int, purchase_id: int, for_update: bool = False
):
    purchase = purchase_repo.get_purchase(
        db,
        company_id=company_id,
        purchase_id=purchase_id,
        for_update=for_update,
    )
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compra no encontrada")
    return purchase


def _validate_purchase_references(
    db: Session, *, company_id: int, payload: InventoryPurchaseCreate
):
    supplier = inventory_repo.get_supplier(
        db, company_id=company_id, supplier_id=payload.supplier_id
    )
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    if payload.client_id is not None:
        client_service.get_client(db, company_id, payload.client_id)
    for line in payload.lines:
        material = inventory_repo.get_material(
            db, company_id=company_id, material_id=line.material_id
        )
        if material is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material no encontrado")
        warehouse = inventory_repo.get_warehouse(
            db, company_id=company_id, warehouse_id=line.warehouse_id
        )
        if warehouse is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Almacén no encontrado")
    return supplier


def _get_or_create_lot(
    db: Session,
    *,
    company_id: int,
    material_id: int,
    warehouse_id: int,
    code: str | None,
    expires_at,
):
    if code is None:
        return None
    lot = inventory_repo.get_lot_by_code(
        db,
        company_id=company_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        code=code,
    )
    if lot is None:
        return inventory_repo.create_lot(
            db,
            company_id=company_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            code=code,
            expires_at=expires_at,
        )
    if expires_at is not None and lot.expires_at not in (None, expires_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El lote ya existe con una fecha de caducidad distinta",
        )
    if lot.expires_at is None and expires_at is not None:
        lot.expires_at = expires_at
    return lot


def _commit_purchase(db: Session, *, company_id: int, purchase_id: int):
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar la compra por un conflicto de datos",
        ) from error
    return _get_purchase_or_404(db, company_id=company_id, purchase_id=purchase_id)


def list_purchases(db: Session, current_user: User):
    company_id = _company_id(
        db,
        current_user,
        inventory_capability=INVENTORY_READ,
        finance_capability=FINANCE_READ,
    )
    return purchase_repo.list_purchases(db, company_id=company_id)


def create_purchase(
    db: Session, current_user: User, payload: InventoryPurchaseCreate
):
    company_id = _company_id(
        db,
        current_user,
        inventory_capability=INVENTORY_MANAGE,
        finance_capability=FINANCE_MANAGE,
    )
    supplier = _validate_purchase_references(db, company_id=company_id, payload=payload)
    base_amount = _expense_base_amount(payload)
    expense = expense_repo.create_expense(
        db,
        company_id=company_id,
        created_by_user_id=current_user.id,
        commit=False,
        expense_date=payload.expense_date,
        client_id=payload.client_id,
        vendor=supplier.name,
        category=payload.category,
        description=payload.description,
        payment_method=payload.payment_method,
        base_amount=float(base_amount),
        tax_amount=float(payload.tax_amount),
        total_amount=float(base_amount + payload.tax_amount),
        receipt_url=payload.receipt_url,
        notes=payload.notes,
    )
    purchase = purchase_repo.create_purchase(
        db,
        company_id=company_id,
        supplier_id=supplier.id,
        expense_id=expense.id,
        status="received",
        supplier_name_snapshot=supplier.name,
        supplier_tax_id_snapshot=supplier.tax_id,
        reference=payload.reference,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    for line in payload.lines:
        lot = _get_or_create_lot(
            db,
            company_id=company_id,
            material_id=line.material_id,
            warehouse_id=line.warehouse_id,
            code=line.lot_code,
            expires_at=line.lot_expires_at,
        )
        movement = inventory_repo.create_movement(
            db,
            company_id=company_id,
            material_id=line.material_id,
            warehouse_id=line.warehouse_id,
            lot_id=lot.id if lot else None,
            movement_type="receipt",
            quantity=line.quantity,
            unit_cost=line.unit_cost,
            reference=payload.reference or f"Compra #{purchase.id}",
            notes=payload.notes,
            recorded_by_user_id=current_user.id,
        )
        purchase_repo.create_purchase_line(
            db,
            purchase_id=purchase.id,
            material_id=line.material_id,
            warehouse_id=line.warehouse_id,
            movement_id=movement.id,
            lot_id=lot.id if lot else None,
            quantity=line.quantity,
            unit_cost=line.unit_cost,
        )
    return _commit_purchase(db, company_id=company_id, purchase_id=purchase.id)


def reverse_purchase(
    db: Session,
    current_user: User,
    purchase_id: int,
    payload: InventoryPurchaseReversal,
):
    company_id = _company_id(
        db,
        current_user,
        inventory_capability=INVENTORY_MANAGE,
        finance_capability=FINANCE_MANAGE,
    )
    purchase = _get_purchase_or_404(
        db, company_id=company_id, purchase_id=purchase_id, for_update=True
    )
    if purchase.status != "received":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La compra ya fue corregida",
        )

    quantities: dict[tuple[int, int, int | None], Decimal] = defaultdict(
        lambda: Decimal("0")
    )
    for line in purchase.lines:
        quantities[(line.material_id, line.warehouse_id, line.lot_id)] += line.quantity
    for material_id, warehouse_id, lot_id in sorted(quantities):
        warehouse = inventory_repo.get_warehouse(
            db,
            company_id=company_id,
            warehouse_id=warehouse_id,
            for_update=True,
        )
        if warehouse is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Almacén no encontrado")
        required_quantity = quantities[(material_id, warehouse_id, lot_id)]
        available = inventory_repo.available_quantity(
            db,
            company_id=company_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
        )
        lot_available = (
            inventory_repo.available_lot_quantity(
                db, company_id=company_id, lot_id=lot_id
            )
            if lot_id is not None
            else available
        )
        if available < required_quantity or lot_available < required_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay stock suficiente para corregir esta compra",
                headers={"X-WorkHive-Error-Code": "inventory.insufficient_stock"},
            )

    for line in purchase.lines:
        inventory_repo.create_movement(
            db,
            company_id=company_id,
            material_id=line.material_id,
            warehouse_id=line.warehouse_id,
            lot_id=line.lot_id,
            movement_type="adjustment_out",
            quantity=line.quantity,
            unit_cost=line.unit_cost,
            reference=f"Corrección compra #{purchase.id}",
            notes=payload.reason,
            recorded_by_user_id=current_user.id,
        )
    purchase.status = "reversed"
    purchase.reversed_at = datetime.now(timezone.utc)
    purchase.reversed_by_user_id = current_user.id
    purchase.reversal_reason = payload.reason
    purchase.expense.is_active = False
    return _commit_purchase(db, company_id=company_id, purchase_id=purchase.id)
