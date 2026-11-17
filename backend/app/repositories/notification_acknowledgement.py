"""Durable recipient-specific read markers for the legacy task notification feed."""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.notification import Notification


async def list_task_acknowledgements(
    db: AsyncSession, user_id: int, company_id: int
) -> list[dict]:
    result = await db.execute(
        select(
            Notification.entity_id.label("task_item_id"),
            func.max(Notification.read_at).label("read_at"),
        )
        .where(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.entity_type == "task_item",
            Notification.entity_id.is_not(None),
            Notification.read_at.is_not(None),
        )
        .group_by(Notification.entity_id)
        .order_by(Notification.entity_id)
    )
    return [dict(row._mapping) for row in result.all()]


def retire_task_assignments(
    db: Session, *, company_id: int, task_id: int, active_user_ids: set[int]
) -> None:
    """Keep event history while retiring assignment prompts that cannot be acted on."""
    statement = db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.entity_type == "task_item",
        Notification.entity_id == task_id,
        Notification.event_type == "task.assigned",
        Notification.read_at.is_(None),
    )
    if active_user_ids:
        statement = statement.filter(Notification.user_id.notin_(active_user_ids))
    statement.update(
        {Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False
    )


def retire_task_requests(db: Session, *, company_id: int, task_id: int) -> None:
    """A service request ceases to be actionable after any answer or deletion."""
    db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.entity_type == "task_item",
        Notification.entity_id == task_id,
        Notification.event_type == "task.requested",
        Notification.read_at.is_(None),
    ).update({Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
