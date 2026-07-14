from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task_item import TaskItem
from app.models.task_report import TaskReport


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
    result = await db.scalars(statement)
    return list(result.all())


async def get_for_company(
    db: AsyncSession,
    company_id: int,
    report_id: int,
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
    return await db.scalar(statement)
