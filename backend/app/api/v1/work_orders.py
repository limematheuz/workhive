from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderContractCandidate,
    WorkOrderOccurrenceResponse,
    WorkOrderResponse,
    WorkOrderUpdate,
)
from app.services import audit_service, work_order_service


router = APIRouter()


@router.get("/", response_model=list[WorkOrderResponse])
def read_work_orders(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_order_service.list_work_orders(
        db, current_user, status_filter=status_filter
    )


@router.get("/contract-candidates", response_model=list[WorkOrderContractCandidate])
def read_contract_candidates(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_order_service.list_contract_candidates(db, current_user)


@router.post("/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    work_order = work_order_service.create_work_order(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="work_order.created",
        entity_type="work_order",
        entity_id=work_order.id,
        request=request,
        details={"order_type": work_order.order_type, "location_id": work_order.location_id},
    )
    return work_order


@router.get("/{work_order_id}", response_model=WorkOrderResponse)
def read_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_order_service.get_work_order(db, current_user, work_order_id)


@router.patch("/{work_order_id}", response_model=WorkOrderResponse)
def update_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    work_order = work_order_service.update_work_order(
        db, current_user, work_order_id, payload
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="work_order.updated",
        entity_type="work_order",
        entity_id=work_order.id,
        request=request,
        details={"status": work_order.status},
    )
    return work_order


@router.post("/{work_order_id}/generate", response_model=WorkOrderOccurrenceResponse)
def generate_work_order_task(
    work_order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    work_order, task = work_order_service.generate_next_task(
        db, current_user, work_order_id
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="work_order.task_generated",
        entity_type="work_order",
        entity_id=work_order.id,
        request=request,
        details={"task_item_id": task.id},
    )
    return {"work_order": work_order, "task_item_id": task.id}
