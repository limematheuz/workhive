"""Read-only serializers for the first public API surface."""

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.repositories import work_order as work_order_repo


def _serialize_work_order(work_order: WorkOrder) -> dict:
    """Deliberately exclude descriptions, clients, people, pricing and costs."""

    return {
        "id": work_order.id,
        "title": work_order.title,
        "status": work_order.status,
        "order_type": work_order.order_type,
        "location_id": work_order.location_id,
        "scheduled_start_at": work_order.scheduled_start_at,
        "next_occurrence_at": work_order.next_occurrence_at,
        "recurrence_unit": work_order.recurrence_unit,
        "recurrence_interval": work_order.recurrence_interval,
        "recurrence_ends_at": work_order.recurrence_ends_at,
        "estimated_people": work_order.estimated_people,
        "estimated_minutes": work_order.estimated_minutes,
        "updated_at": work_order.updated_at,
    }


def list_work_orders(
    db: Session,
    *,
    company_id: int,
    status_filter: str | None,
    skip: int,
    limit: int,
) -> list[dict]:
    orders = work_order_repo.list_work_orders(
        db,
        company_id=company_id,
        location_ids=None,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return [_serialize_work_order(order) for order in orders]


def get_work_order(
    db: Session,
    *,
    company_id: int,
    work_order_id: int,
) -> dict | None:
    work_order = work_order_repo.get_work_order(
        db,
        company_id=company_id,
        work_order_id=work_order_id,
    )
    return _serialize_work_order(work_order) if work_order is not None else None
