"""Authenticated financial API for customer receipts and allocations."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveFinanceManager,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.models.user import User
from app.schemas.customer_payment import (
    CustomerPaymentCreate,
    CustomerPaymentResponse,
    CustomerPaymentVoid,
)
from app.services import audit_service, customer_payment_service


router = APIRouter()


@router.get("/", response_model=list[CustomerPaymentResponse])
async def read_customer_payments(
    client_id: int | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: customer_payment_service.list_payments(
            sync_db, current_user, client_id=client_id
        )
    )


@router.post("/", response_model=CustomerPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_customer_payment(
    payload: CustomerPaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    payment = customer_payment_service.create_payment(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=payment.company_id,
        action="customer_payment.recorded",
        entity_type="customer_payment",
        entity_id=payment.id,
        request=request,
        details={
            "client_id": payment.client_id,
            "amount": str(payment.amount),
            "allocation_count": len(payment.allocations),
        },
    )
    return payment


@router.post("/{payment_id}/void", response_model=CustomerPaymentResponse)
def void_customer_payment(
    payment_id: int,
    payload: CustomerPaymentVoid,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    payment = customer_payment_service.void_payment(
        db, current_user, payment_id, payload
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=payment.company_id,
        action="customer_payment.voided",
        entity_type="customer_payment",
        entity_id=payment.id,
        request=request,
        details={"allocation_count": len(payment.allocations)},
    )
    return payment
