from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.repositories import notification_inbox
from app.services.user_scope import require_company_context


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
    db: Session, user: User, *, unread_only: bool, limit: int
) -> list[Notification]:
    return notification_inbox.list_notifications(
        db, user.id, require_company_context(user), unread_only=unread_only, limit=limit
    )


def list_unread_task_notifications(
    db: Session, user: User, *, limit: int = 200
) -> list[Notification]:
    return notification_inbox.list_unread_task_notifications(
        db, user.id, require_company_context(user), limit=limit
    )


def count_unread_task_notifications(db: Session, user: User) -> int:
    return notification_inbox.count_unread_task_notifications(
        db, user.id, require_company_context(user)
    )


def mark_read(db: Session, user: User, notification_id: int) -> Notification | None:
    notification = notification_inbox.mark_read(
        db, user.id, require_company_context(user), notification_id
    )
    if notification is not None:
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_read(db: Session, user: User) -> None:
    notification_inbox.mark_all_read(db, user.id, require_company_context(user))
    db.commit()


async def list_notifications_async(
    db: AsyncSession, user: User, *, unread_only: bool, limit: int
) -> list[Notification]:
    return await notification_inbox.list_notifications_async(
        db, user.id, require_company_context(user), unread_only=unread_only, limit=limit
    )


async def mark_read_async(
    db: AsyncSession, user: User, notification_id: int
) -> Notification | None:
    notification = await notification_inbox.mark_read_async(
        db, user.id, require_company_context(user), notification_id
    )
    if notification is not None:
        await db.commit()
        await db.refresh(notification)
    return notification


async def mark_all_read_async(db: AsyncSession, user: User) -> None:
    await notification_inbox.mark_all_read_async(
        db, user.id, require_company_context(user)
    )
    await db.commit()


async def mark_task_item_read_async(
    db: AsyncSession, user: User, *, task_item_id: int
) -> int:
    count = await notification_inbox.mark_task_item_read_async(
        db, user.id, require_company_context(user), task_item_id=task_item_id
    )
    await db.commit()
    return count


async def mark_event_read_async(
    db: AsyncSession, user: User, *, event_type: str
) -> None:
    await notification_inbox.mark_event_read_async(
        db, user.id, require_company_context(user), event_type=event_type
    )
    await db.commit()
