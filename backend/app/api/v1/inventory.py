"""Company inventory API. Movements are append-only by design."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.inventory import (
    InventoryMaterialCreate,
    InventoryMaterialResponse,
    InventoryLotResponse,
    InventoryMovementCreate,
    InventoryMovementResponse,
    InventoryStockBalance,
    InventorySupplierCreate,
    InventorySupplierResponse,
    InventoryWarehouseCreate,
    InventoryWarehouseResponse,
)
from app.services import inventory_service


router = APIRouter()


@router.get("/suppliers", response_model=list[InventorySupplierResponse])
def read_suppliers(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_suppliers(db, current_user)


@router.post(
    "/suppliers",
    response_model=InventorySupplierResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_supplier(
    payload: InventorySupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_service.create_supplier(db, current_user, payload)


@router.get("/materials", response_model=list[InventoryMaterialResponse])
def read_materials(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_materials(db, current_user)


@router.get("/lots", response_model=list[InventoryLotResponse])
def read_lots(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_lot_balances(db, current_user)


@router.post(
    "/materials",
    response_model=InventoryMaterialResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_material(
    payload: InventoryMaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_service.create_material(db, current_user, payload)


@router.get("/warehouses", response_model=list[InventoryWarehouseResponse])
def read_warehouses(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_warehouses(db, current_user)


@router.post(
    "/warehouses",
    response_model=InventoryWarehouseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_warehouse(
    payload: InventoryWarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_service.create_warehouse(db, current_user, payload)


@router.get("/movements", response_model=list[InventoryMovementResponse])
def read_movements(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_movements(db, current_user)


@router.post(
    "/movements",
    response_model=InventoryMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_movement(
    payload: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_service.create_movement(db, current_user, payload)


@router.get("/stock", response_model=list[InventoryStockBalance])
def read_stock_balances(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_service.list_stock_balances(db, current_user)
