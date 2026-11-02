from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.repositories.task_assignment_scope import assigned_task_condition


def _load_options():
    return (
        selectinload(TaskReport.task_item).selectinload(TaskItem.location),
        selectinload(TaskReport.reporter_company),
        selectinload(TaskReport.requesting_company),
        selectinload(TaskReport.checklist_item),
    )


async def get_by_user_event(
    db: AsyncSession,
    reporter_user_id: int,
    client_event_id: str,
) -> TaskReport | None:
    statement = (
        select(TaskReport)
        .options(*_load_options())
        .where(
            TaskReport.reporter_user_id == reporter_user_id,
            TaskReport.client_event_id == client_event_id,
        )
    )
    return await db.scalar(statement)


async def list_for_company(
    db: AsyncSession,
    company_id: int,
    *,
    skip: int,
    limit: int,
    location_ids: set[int] | None = None,
    assigned_user_id: int | None = None,
) -> list[TaskReport]:
    statement = (
        select(TaskReport)
        .options(*_load_options())
        .where(
            or_(
                TaskReport.reporter_company_id == company_id,
                TaskReport.requesting_company_id == company_id,
            )
        )
        .order_by(TaskReport.created_at.desc(), TaskReport.id.desc())
        .offset(skip)
        .limit(limit)
    )
    if location_ids is not None:
        statement = statement.where(
            TaskReport.task_item.has(TaskItem.location_id.in_(location_ids))
        )
    if assigned_user_id is not None:
        statement = statement.where(
            TaskReport.task_item.has(assigned_task_condition(assigned_user_id))
        )
    result = await db.scalars(statement)
    return list(result.all())


async def get_for_company(
    db: AsyncSession,
    company_id: int,
    report_id: int,
    *,
    assigned_user_id: int | None = None,
) -> TaskReport | None:
    statement = (
        select(TaskReport)
        .options(*_load_options())
        .where(
            TaskReport.id == report_id,
            or_(
                TaskReport.reporter_company_id == company_id,
                TaskReport.requesting_company_id == company_id,
            ),
        )
    )
    if assigned_user_id is not None:
        statement = statement.where(
            TaskReport.task_item.has(assigned_task_condition(assigned_user_id))
        )
    return await db.scalar(statement)


async def list_by_ids_for_company(
    db: AsyncSession,
    company_id: int,
    report_ids: list[int],
    *,
    assigned_user_id: int | None = None,
) -> list[TaskReport]:
    if not report_ids:
        return []
    statement = (
        select(TaskReport)
        .options(*_load_options())
        .where(
            TaskReport.id.in_(report_ids),
            or_(
                TaskReport.reporter_company_id == company_id,
                TaskReport.requesting_company_id == company_id,
            ),
        )
    )
    if assigned_user_id is not None:
        statement = statement.where(
            TaskReport.task_item.has(assigned_task_condition(assigned_user_id))
        )
    result = await db.scalars(statement)
    return list(result.all())
