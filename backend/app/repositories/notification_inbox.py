"""Recipient-scoped notification inbox queries and acknowledgements."""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.notification import Notification


def list_notifications(
    db: Session,
    user_id: int,
    company_id: int,
    *,
    unread_only: bool,
    limit: int,
) -> list[Notification]:
    query = db.query(Notification).filter(
        Notification.user_id == user_id, Notification.company_id == company_id
    )
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )


def list_unread_task_notifications(
    db: Session,
    user_id: int,
    company_id: int,
    *,
    limit: int = 200,
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.entity_type == "task_item",
            Notification.read_at.is_(None),
        )
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )


def count_unread_task_notifications(db: Session, user_id: int, company_id: int) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.entity_type == "task_item",
            Notification.read_at.is_(None),
        )
        .count()
    )


def mark_read(
    db: Session, user_id: int, company_id: int, notification_id: int
) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
            Notification.company_id == company_id,
        )
        .first()
    )
    if not notification:
        return None
    notification.read_at = notification.read_at or datetime.now(timezone.utc)
    return notification


def mark_all_read(db: Session, user_id: int, company_id: int) -> None:
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.company_id == company_id,
        Notification.read_at.is_(None),
    ).update(
        {Notification.read_at: datetime.now(timezone.utc)},
        synchronize_session=False,
    )


async def list_notifications_async(
    db: AsyncSession,
    user_id: int,
    company_id: int,
    *,
    unread_only: bool,
    limit: int,
) -> list[Notification]:
    statement = select(Notification).where(
        Notification.user_id == user_id, Notification.company_id == company_id
    )
    if unread_only:
        statement = statement.where(Notification.read_at.is_(None))
    statement = statement.order_by(
        Notification.created_at.desc(),
        Notification.id.desc(),
    ).limit(limit)
    result = await db.scalars(statement)
    return list(result.all())


async def mark_read_async(
    db: AsyncSession,
    user_id: int,
    company_id: int,
    notification_id: int,
) -> Notification | None:
    statement = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
        Notification.company_id == company_id,
    )
    notification = await db.scalar(statement)
    if not notification:
        return None
    notification.read_at = notification.read_at or datetime.now(timezone.utc)
    return notification


async def mark_all_read_async(db: AsyncSession, user_id: int, company_id: int) -> None:
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.execute(statement)


async def mark_task_item_read_async(
    db: AsyncSession,
    user_id: int,
    company_id: int,
    *,
    task_item_id: int,
) -> int:
    """Acknowledge every unread event for one task, for its recipient only.

    A task can produce more than one notification (assignment, report, status
    change). Opening that task is an acknowledgement of the whole event group,
    not only of the row the user happened to click. Recipient and company filters stay in the write query.
    """
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.entity_type == "task_item",
            Notification.entity_id == task_item_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    result = await db.execute(statement)
    return result.rowcount or 0


async def mark_event_read_async(
    db: AsyncSession,
    user_id: int,
    company_id: int,
    *,
    event_type: str,
) -> None:
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.company_id == company_id,
            Notification.event_type == event_type,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.execute(statement)
