from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.location import Location
from app.models.location_template import LocationTemplate
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from app.models.location_zone import TaskZone


def _user_assignment_conditions(user_id: int):
    return [
        TaskItem.assignments.any(TaskAssignment.user_id == user_id),
        TaskItem.user_id == user_id,
    ]


def _load_options():
    return (
        selectinload(TaskItem.location).selectinload(Location.client),
        selectinload(TaskItem.location).selectinload(Location.company_access),
        selectinload(TaskItem.location)
        .selectinload(Location.templates)
        .selectinload(LocationTemplate.template),
        selectinload(TaskItem.user),
        selectinload(TaskItem.accepted_by),
        selectinload(TaskItem.work_sessions),
        selectinload(TaskItem.assignments).selectinload(TaskAssignment.user),
        selectinload(TaskItem.checklist_items)
        .selectinload(TaskChecklistItem.assignments)
        .selectinload(TaskChecklistAssignment.user),
        selectinload(TaskItem.zones).selectinload(TaskZone.zone),
        selectinload(TaskItem.checkout_reservation).selectinload(
            Reservation.owner_company
        ),
        selectinload(TaskItem.checkout_reservation).selectinload(
            Reservation.created_by
        ),
        selectinload(TaskItem.next_reservation).selectinload(
            Reservation.owner_company
        ),
        selectinload(TaskItem.next_reservation).selectinload(Reservation.created_by),
    )


def _company_scope(company_id: int):
    return or_(
        and_(TaskItem.status != "rejected", TaskItem.company_id == company_id),
        and_(
            TaskItem.status == "rejected",
            TaskItem.checkout_reservation_id.is_(None),
            TaskItem.company_id == company_id,
        ),
        TaskItem.checkout_reservation.has(Reservation.owner_company_id == company_id),
    )


async def get_task_items(
    db: AsyncSession,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
) -> list[TaskItem]:
    statement = (
        select(TaskItem)
        .join(Location)
        .outerjoin(Client)
        .options(*_load_options())
        .where(_company_scope(company_id))
    )
    if user_id:
        statement = statement.where(or_(*_user_assignment_conditions(user_id)))
    if location_id:
        statement = statement.where(TaskItem.location_id == location_id)
    if not include_requested:
        statement = statement.where(TaskItem.status != "requested")
    else:
        statement = statement.where(
            or_(TaskItem.status != "requested", TaskItem.company_id == company_id)
        )
    if status:
        statement = statement.where(TaskItem.status == status)
    statement = statement.order_by(TaskItem.id.asc()).offset(skip).limit(limit)
    result = await db.scalars(statement)
    return list(result.all())


async def get_task_item(
    db: AsyncSession,
    company_id: int,
    task_item_id: int,
) -> TaskItem | None:
    statement = (
        select(TaskItem)
        .join(Location)
        .outerjoin(Client)
        .options(*_load_options())
        .where(
            _company_scope(company_id),
            TaskItem.id == task_item_id,
        )
    )
    return await db.scalar(statement)
