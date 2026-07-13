from datetime import datetime, timezone

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
