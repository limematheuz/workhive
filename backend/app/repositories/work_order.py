from sqlalchemy.orm import Session

from app.models.service_contract import ServiceContract, ServiceContractLocation
from app.models.work_order import WorkOrder


def list_work_orders(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
    status: str | None = None,
) -> list[WorkOrder]:
    query = db.query(WorkOrder).filter(WorkOrder.company_id == company_id)
    if location_ids is not None:
        query = query.filter(WorkOrder.location_id.in_(location_ids))
    if status is not None:
        query = query.filter(WorkOrder.status == status)
    return query.order_by(WorkOrder.next_occurrence_at.asc().nullslast(), WorkOrder.id.desc()).all()


def get_work_order(
    db: Session, *, company_id: int, work_order_id: int, for_update: bool = False
) -> WorkOrder | None:
    query = db.query(WorkOrder).filter(
        WorkOrder.company_id == company_id, WorkOrder.id == work_order_id
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def create_work_order(db: Session, **values) -> WorkOrder:
    work_order = WorkOrder(**values)
    db.add(work_order)
    db.flush()
    return work_order


def list_contract_candidates(
    db: Session, *, company_id: int, location_ids: set[int] | None
) -> list[tuple[ServiceContract, ServiceContractLocation]]:
    query = (
        db.query(ServiceContract, ServiceContractLocation)
        .join(
            ServiceContractLocation,
            ServiceContractLocation.contract_id == ServiceContract.id,
        )
        .filter(
            ServiceContract.company_id == company_id,
            ServiceContract.status == "active",
            ServiceContractLocation.is_active.is_(True),
        )
    )
    if location_ids is not None:
        query = query.filter(ServiceContractLocation.location_id.in_(location_ids))
    return query.order_by(
        ServiceContract.title.asc(), ServiceContractLocation.location_id.asc()
    ).all()


def task_exists_for_occurrence(
    db: Session, *, work_order_id: int, scheduled_start_at
) -> bool:
    from app.models.task_item import TaskItem

    return db.query(TaskItem.id).filter(
        TaskItem.work_order_id == work_order_id,
        TaskItem.scheduled_start_at == scheduled_start_at,
    ).first() is not None
