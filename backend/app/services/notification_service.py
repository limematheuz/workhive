from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def notify_users(
    db: Session,
    *,
    users: list[User],
    event_type: str,
    title: str,
    message: str,
    entity_type: str,
    entity_id: int,
    href: str,
    metadata: dict | None = None,
) -> None:
    unique_users = {user.id: user for user in users if user.is_active and user.company_id}
    db.add_all([
        Notification(
            user_id=user.id,
            company_id=user.company_id,
            event_type=event_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            href=href,
            metadata_json=metadata or {},
        )
        for user in unique_users.values()
    ])
    db.commit()


def list_notifications(
    db: Session,
    user: User,
    *,
    unread_only: bool,
    limit: int,
) -> list[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )


def list_unread_task_notifications(
    db: Session,
    user: User,
    *,
    limit: int = 200,
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.entity_type == "task_item",
            Notification.read_at.is_(None),
        )
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )


def count_unread_task_notifications(db: Session, user: User) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.entity_type == "task_item",
            Notification.read_at.is_(None),
        )
        .count()
    )


def mark_read(db: Session, user: User, notification_id: int) -> Notification | None:
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notification:
        return None
    notification.read_at = notification.read_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_read(db: Session, user: User) -> None:
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read_at.is_(None),
    ).update(
        {Notification.read_at: datetime.now(timezone.utc)},
        synchronize_session=False,
    )
    db.commit()


async def list_notifications_async(
    db: AsyncSession,
    user: User,
    *,
    unread_only: bool,
    limit: int,
) -> list[Notification]:
    statement = select(Notification).where(Notification.user_id == user.id)
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
    user: User,
    notification_id: int,
) -> Notification | None:
    statement = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    )
    notification = await db.scalar(statement)
    if not notification:
        return None
    notification.read_at = notification.read_at or datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_read_async(db: AsyncSession, user: User) -> None:
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.execute(statement)
    await db.commit()
