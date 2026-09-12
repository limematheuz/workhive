"""Purchase API for the finance-to-inventory receipt workflow."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.inventory_purchase import (
    InventoryPurchaseCreate,
    InventoryPurchaseResponse,
    InventoryPurchaseReversal,
)
from app.services import inventory_purchase_service


router = APIRouter()


@router.get("/", response_model=list[InventoryPurchaseResponse])
def read_purchases(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return inventory_purchase_service.list_purchases(db, current_user)


@router.post("/", response_model=InventoryPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: InventoryPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_purchase_service.create_purchase(db, current_user, payload)


@router.post(
    "/{purchase_id}/reverse",
    response_model=InventoryPurchaseResponse,
)
def reverse_purchase(
    purchase_id: int,
    payload: InventoryPurchaseReversal,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return inventory_purchase_service.reverse_purchase(
        db, current_user, purchase_id, payload
    )
