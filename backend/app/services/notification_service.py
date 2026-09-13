from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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
    commit: bool = True,
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
    if commit:
        db.commit()
    else:
        db.flush()


def notify_users_once(
    db: Session,
    *,
    users: list[User],
    event_type: str,
    title: str,
    message: str,
    entity_type: str,
    entity_id: int,
    href: str,
    dedupe_key: str,
    metadata: dict | None = None,
    commit: bool = True,
) -> int:
    """Persist one notification per recipient and business event.

    Polling, retries and idempotent commands can execute the same service more
    than once. The explicit key prevents duplicate user notifications without
    coupling deduplication to translated titles or messages.
    """
    unique_users = {user.id: user for user in users if user.is_active and user.company_id}
    if not unique_users:
        return 0

    event_metadata = {**(metadata or {}), "dedupe_key": dedupe_key}
    dialect_name = db.get_bind().dialect.name
    insert = postgresql_insert if dialect_name == "postgresql" else sqlite_insert
    notification_count = 0
    for user in unique_users.values():
        statement = insert(Notification).values(
            user_id=user.id,
            company_id=user.company_id,
            event_type=event_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            href=href,
            dedupe_key=dedupe_key,
            metadata_json=event_metadata,
        ).on_conflict_do_nothing(
            index_elements=[
                "user_id",
                "event_type",
                "entity_type",
                "entity_id",
                "dedupe_key",
            ]
        )
        result = db.execute(statement)
        notification_count += int(result.rowcount or 0)
    if commit:
        db.commit()
    return notification_count


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


async def mark_task_item_read_async(
    db: AsyncSession,
    user: User,
    *,
    task_item_id: int,
) -> int:
    """Acknowledge every unread event for one task, for its recipient only.

    A task can produce more than one notification (assignment, report, status
    change). Opening that task is an acknowledgement of the whole event group,
    not only of the row the user happened to click. The user filter is kept in
    the write query so a caller can never mark another user's notifications.
    """
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.entity_type == "task_item",
            Notification.entity_id == task_item_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    result = await db.execute(statement)
    await db.commit()
    return result.rowcount or 0


async def mark_event_read_async(
    db: AsyncSession,
    user: User,
    *,
    event_type: str,
) -> None:
    statement = (
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.event_type == event_type,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.execute(statement)
    await db.commit()
