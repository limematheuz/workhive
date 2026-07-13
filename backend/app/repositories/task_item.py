from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.task_item import TaskItem
from app.models.location import Location
from app.models.client import Client
from app.models.reservation import Reservation
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate
from datetime import datetime


def _user_assignment_conditions(user_id: int):
    return [
        TaskItem.user_id == user_id,
        TaskItem.description.like(f"%(@{user_id}:%"),
        TaskItem.description.like(f"%(@{user_id})%"),
        TaskItem.description.like(f"%workhive_assignees:{user_id} -->%"),
        TaskItem.description.like(f"%workhive_assignees:{user_id},%"),
        TaskItem.description.like(f"%,{user_id},%"),
        TaskItem.description.like(f"%,{user_id} -->%"),
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
    if not include_requested:
        query = query.filter(TaskItem.status != "requested")
    else:
        query = query.filter(
            or_(
                TaskItem.status != "requested",
                TaskItem.company_id == company_id,
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


def create_task_item(
    db: Session,
    company_id: int,
    task_item_data: TaskItemCreate,
) -> TaskItem:
    dump = task_item_data.model_dump()
    if dump.get("created_at") is None:
        dump.pop("created_at", None)
    db_task_item = TaskItem(**dump, company_id=company_id)
    db.add(db_task_item)
    db.commit()
    db.refresh(db_task_item)
    return db_task_item


def update_task_item(
    db: Session, db_task_item: TaskItem, task_item_data: TaskItemUpdate
) -> TaskItem:
    update_data = task_item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task_item, key, value)
    db.add(db_task_item)
    db.commit()
    db.refresh(db_task_item)
    return db_task_item


def delete_task_item(db: Session, db_task_item: TaskItem) -> None:
    db.delete(db_task_item)
    db.commit()


def count_tasks_by_user(
    db: Session, user_id: int, start_date: datetime | None = None
) -> int:
    query = db.query(TaskItem).filter(or_(*_user_assignment_conditions(user_id)))
    if start_date:
        query = query.filter(TaskItem.created_at >= start_date)
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
