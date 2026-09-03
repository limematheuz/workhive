from collections.abc import Collection
from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.location import Location
from app.models.client import Client
from app.models.reservation import Reservation
from app.models.task_structure import TaskAssignment
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate


def _user_assignment_conditions(user_id: int):
    return [
        TaskItem.assignments.any(TaskAssignment.user_id == user_id),
        TaskItem.user_id == user_id,
    ]


def get_task_items(
    db: Session,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
    location_ids: set[int] | None = None,
    requested_location_ids: set[int] | None = None,
) -> list[TaskItem]:
    query = (
        db.query(TaskItem)
        .join(Location)
        .outerjoin(Client)
        .filter(
            or_(
                and_(
                    TaskItem.status != "rejected",
                    TaskItem.company_id == company_id,
                ),
                and_(
                    TaskItem.status == "rejected",
                    TaskItem.checkout_reservation_id.is_(None),
                    TaskItem.company_id == company_id,
                ),
                TaskItem.checkout_reservation.has(
                    Reservation.owner_company_id == company_id
                ),
            )
        )
    )
    if user_id:
        query = query.filter(or_(*_user_assignment_conditions(user_id)))
    if location_id:
        query = query.filter(TaskItem.location_id == location_id)
    if location_ids is not None:
        query = query.filter(TaskItem.location_id.in_(location_ids))
    if not include_requested:
        query = query.filter(TaskItem.status != "requested")
    elif requested_location_ids is None:
        query = query.filter(
            or_(
                TaskItem.status != "requested",
                TaskItem.company_id == company_id,
            )
        )
    else:
        query = query.filter(
            or_(
                TaskItem.status != "requested",
                TaskItem.location_id.in_(requested_location_ids),
            )
        )
    if status:
        query = query.filter(TaskItem.status == status)
    return query.order_by(TaskItem.id.asc()).offset(skip).limit(limit).all()


def get_task_item(db: Session, company_id: int, task_item_id: int) -> TaskItem | None:
    return (
        db.query(TaskItem)
        .join(Location)
        .outerjoin(Client)
        .filter(
            or_(
                and_(
                    TaskItem.status != "rejected",
                    TaskItem.company_id == company_id,
                ),
                and_(
                    TaskItem.status == "rejected",
                    TaskItem.checkout_reservation_id.is_(None),
                    TaskItem.company_id == company_id,
                ),
                TaskItem.checkout_reservation.has(
                    Reservation.owner_company_id == company_id
                ),
            )
        )
        .filter(TaskItem.id == task_item_id)
        .first()
    )


def get_task_items_by_ids(
    db: Session,
    company_id: int,
    task_item_ids: list[int],
    user_id: int | None = None,
) -> list[TaskItem]:
    if not task_item_ids:
        return []

    query = (
        db.query(TaskItem)
        .join(Location)
        .outerjoin(Client)
        .filter(
            or_(
                and_(
                    TaskItem.status != "rejected",
                    TaskItem.company_id == company_id,
                ),
                and_(
                    TaskItem.status == "rejected",
                    TaskItem.checkout_reservation_id.is_(None),
                    TaskItem.company_id == company_id,
                ),
                TaskItem.checkout_reservation.has(
                    Reservation.owner_company_id == company_id
                ),
            )
        )
        .filter(TaskItem.id.in_(task_item_ids))
    )
    if user_id is not None:
        query = query.filter(or_(*_user_assignment_conditions(user_id)))
    return query.order_by(TaskItem.id.asc()).all()


def create_task_item(
    db: Session,
    company_id: int,
    task_item_data: TaskItemCreate,
) -> TaskItem:
    dump = task_item_data.model_dump(
        exclude={"zone_ids", "space_ids", "space_task_template_ids"}
    )
    if dump.get("created_at") is None:
        dump.pop("created_at", None)
    db_task_item = TaskItem(**dump, company_id=company_id)
    db.add(db_task_item)
    db.flush()
    return db_task_item


def update_task_item(
    db: Session, db_task_item: TaskItem, task_item_data: TaskItemUpdate
) -> TaskItem:
    update_data = task_item_data.model_dump(
        exclude_unset=True,
        exclude={"zone_ids", "space_ids"},
    )
    for key, value in update_data.items():
        setattr(db_task_item, key, value)
    db.add(db_task_item)
    db.flush()
    return db_task_item


def delete_task_item(db: Session, db_task_item: TaskItem) -> None:
    db.delete(db_task_item)
    db.flush()


def count_tasks_by_user(
    db: Session,
    user_id: int,
    start_date: datetime | None = None,
    statuses: Collection[str] | None = None,
) -> int:
    query = db.query(TaskItem).filter(or_(*_user_assignment_conditions(user_id)))
    if start_date:
        query = query.filter(TaskItem.created_at >= start_date)
    if statuses is not None:
        query = query.filter(TaskItem.status.in_(statuses))
    return query.count()


def count_tasks_by_user_and_status(
    db: Session, user_id: int, status: str, start_date: datetime | None = None
) -> int:
    query = (
        db.query(TaskItem)
        .filter(or_(*_user_assignment_conditions(user_id)))
        .filter(TaskItem.status == status)
    )
    if start_date:
        query = query.filter(TaskItem.created_at >= start_date)
    return query.count()


def get_distinct_location_ids_by_user(
    db: Session, user_id: int, start_date: datetime | None = None
) -> list[int]:
    query = (
        db.query(TaskItem.location_id)
        .filter(or_(*_user_assignment_conditions(user_id)))
        .filter(TaskItem.location_id.isnot(None))
    )
    if start_date:
        query = query.filter(TaskItem.created_at >= start_date)
    results = query.distinct().all()
    return [r[0] for r in results]
