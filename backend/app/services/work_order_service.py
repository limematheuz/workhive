"""Plan contractual and ad-hoc work without mutating legacy task records."""

from calendar import monthrange
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.work_order import WorkOrder
from app.repositories import service_contract as service_contract_repo
from app.repositories import work_order as work_order_repo
from app.schemas.task_item import TaskItemCreate
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    _validate_recurrence,
    normalize_work_order_date,
)
from app.services import location_access_service, task_item_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context


def _require_work_orders(company_id: int, db: Session) -> None:
    require_company_feature(db, company_id=company_id, code="features.work_orders")


def _validate_contract_coverage(
    db: Session,
    *,
    company_id: int,
    location_id: int,
    service_contract_id: int | None,
) -> None:
    if service_contract_id is None:
        return
    contract = service_contract_repo.get_contract(db, company_id, service_contract_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    if contract.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La orden solo puede vincularse a un contrato activo",
        )
    link = service_contract_repo.get_contract_location(
        db, contract.id, location_id
    )
    if link is None or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La ubicación no está cubierta por este contrato activo",
        )


def _advance_occurrence(work_order: WorkOrder) -> None:
    current = work_order.next_occurrence_at
    if current is None:
        work_order.status = "completed"
        return
    if work_order.order_type == "one_off":
        work_order.next_occurrence_at = None
        work_order.status = "completed"
        return
    if work_order.recurrence_unit == "weekly":
        candidate = current + timedelta(weeks=work_order.recurrence_interval or 1)
    else:
        month = current.month - 1 + (work_order.recurrence_interval or 1)
        year = current.year + month // 12
        month = month % 12 + 1
        candidate = current.replace(year=year, month=month, day=min(current.day, monthrange(year, month)[1]))
    if work_order.recurrence_ends_at is not None and (
        normalize_work_order_date(candidate) > normalize_work_order_date(work_order.recurrence_ends_at)
    ):
        work_order.next_occurrence_at = None
        work_order.status = "completed"
    else:
        work_order.next_occurrence_at = candidate


def list_work_orders(db: Session, current_user: User, *, status_filter: str | None = None):
    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    return work_order_repo.list_work_orders(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, "work.read"),
        status=status_filter,
    )


def list_contract_candidates(db: Session, current_user: User):
    """Return operational contract choices without exposing prices or terms."""

    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    candidates = work_order_repo.list_contract_candidates(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, "work.manage"),
    )
    return [
        {
            "contract_id": contract.id,
            "contract_title": contract.title,
            "location_id": link.location_id,
            "location_name": link.location.name if link.location else f"Ubicación {link.location_id}",
        }
        for contract, link in candidates
    ]


def get_work_order(db: Session, current_user: User, work_order_id: int) -> WorkOrder:
    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    work_order = work_order_repo.get_work_order(
        db, company_id=company_id, work_order_id=work_order_id
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    location_access_service.require_location_capability(
        db, current_user, work_order.location_id, "can_manage_tasks", permission_code="work.read"
    )
    return work_order


def create_work_order(db: Session, current_user: User, data: WorkOrderCreate) -> WorkOrder:
    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    location_access_service.require_location_capability(
        db, current_user, data.location_id, "can_manage_tasks", permission_code="work.manage"
    )
    if data.order_type == "recurring":
        require_company_feature(db, company_id=company_id, code="features.recurrence")
    _validate_contract_coverage(
        db,
        company_id=company_id,
        location_id=data.location_id,
        service_contract_id=data.service_contract_id,
    )
    values = data.model_dump()
    values.update(
        company_id=company_id,
        created_by_user_id=current_user.id,
        next_occurrence_at=data.scheduled_start_at,
    )
    try:
        work_order = work_order_repo.create_work_order(db, **values)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return work_order


def update_work_order(
    db: Session, current_user: User, work_order_id: int, data: WorkOrderUpdate
) -> WorkOrder:
    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    work_order = work_order_repo.get_work_order(
        db, company_id=company_id, work_order_id=work_order_id, for_update=True
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    location_access_service.require_location_capability(
        db, current_user, work_order.location_id, "can_manage_tasks", permission_code="work.manage"
    )
    updates = data.model_dump(exclude_unset=True)
    should_reschedule = (
        "scheduled_start_at" in updates
        and work_order.next_occurrence_at == work_order.scheduled_start_at
    )
    next_start = updates.get("scheduled_start_at", work_order.scheduled_start_at)
    next_unit = updates.get("recurrence_unit", work_order.recurrence_unit)
    next_interval = updates.get("recurrence_interval", work_order.recurrence_interval)
    next_end = updates.get("recurrence_ends_at", work_order.recurrence_ends_at)
    try:
        _validate_recurrence(
            work_order.order_type, next_unit, next_interval, next_start, next_end
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    if work_order.order_type == "recurring":
        require_company_feature(db, company_id=company_id, code="features.recurrence")
    if "next_occurrence_at" in updates:
        if work_order.order_type != "recurring":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Solo las órdenes recurrentes pueden replanificar la próxima ejecución",
            )
        next_occurrence = updates["next_occurrence_at"]
        if next_occurrence is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Una orden recurrente necesita una próxima ejecución",
            )
        if next_end is not None and (
            normalize_work_order_date(next_occurrence) > normalize_work_order_date(next_end)
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La próxima ejecución no puede ser posterior al final de la recurrencia",
            )
    for key, value in updates.items():
        setattr(work_order, key, value)
    if should_reschedule:
        work_order.next_occurrence_at = updates["scheduled_start_at"]
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return work_order


def generate_next_task(db: Session, current_user: User, work_order_id: int):
    company_id = require_company_context(current_user)
    _require_work_orders(company_id, db)
    work_order = work_order_repo.get_work_order(
        db, company_id=company_id, work_order_id=work_order_id, for_update=True
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    location_access_service.require_location_capability(
        db, current_user, work_order.location_id, "can_manage_tasks", permission_code="work.manage"
    )
    if work_order.status != "active" or work_order.next_occurrence_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La orden no tiene una próxima ejecución activa",
        )
    if work_order_repo.task_exists_for_occurrence(
        db,
        work_order_id=work_order.id,
        scheduled_start_at=work_order.next_occurrence_at,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La próxima ejecución ya fue creada",
        )
    occurrence_at = work_order.next_occurrence_at
    _advance_occurrence(work_order)
    task = task_item_service.create_task_item(
        db,
        current_user,
        TaskItemCreate(
            title=work_order.title,
            description=work_order.description,
            location_id=work_order.location_id,
            unit="service",
            scheduled_start_at=occurrence_at,
            service_context="contract" if work_order.service_contract_id else "standalone",
        ),
        work_order_id=work_order.id,
    )
    return work_order, task
