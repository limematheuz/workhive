from datetime import datetime, timezone

from app.models.company import Company
from app.models.notification import Notification
from app.models.user import User
from app.services import notification_service


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-ALERTS",
        address="Alert Street 1",
        phone="600000001",
        email=f"{name.lower()}@alerts.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, email: str, role_id: int = 1) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@", 1)[0],
        role_id=role_id,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _notification(
    db,
    *,
    user: User,
    entity_type: str,
    entity_id: int,
    read_at: datetime | None = None,
    event_type: str = "task.assigned",
) -> Notification:
    notification = Notification(
        user_id=user.id,
        company_id=user.company_id,
        event_type=event_type,
        title="Alert",
        message="Alert message",
        entity_type=entity_type,
        entity_id=entity_id,
        href="/dashboard/tasks",
        metadata_json={},
        read_at=read_at,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def test_count_unread_task_notifications_ignores_read_and_non_task_items(db):
    company = _company(db, "AlertCo")
    user = _user(db, company, "viewer@alerts.test", role_id=3)
    other = _user(db, company, "other@alerts.test", role_id=3)

    _notification(db, user=user, entity_type="task_item", entity_id=1)
    _notification(db, user=user, entity_type="task_item", entity_id=2)
    _notification(
        db,
        user=user,
        entity_type="task_item",
        entity_id=3,
        read_at=datetime.now(timezone.utc),
    )
    _notification(db, user=user, entity_type="reservation", entity_id=4)
    _notification(db, user=other, entity_type="task_item", entity_id=5)

    assert notification_service.count_unread_task_notifications(db, user) == 2


def test_count_unread_task_notifications_returns_zero_when_none(db):
    company = _company(db, "EmptyAlerts")
    user = _user(db, company, "empty@alerts.test")

    assert notification_service.count_unread_task_notifications(db, user) == 0


def test_count_unread_task_notifications_is_scoped_to_current_user(db):
    company = _company(db, "ScopedAlerts")
    alice = _user(db, company, "alice@alerts.test")
    bob = _user(db, company, "bob@alerts.test")

    _notification(db, user=alice, entity_type="task_item", entity_id=10)
    _notification(db, user=alice, entity_type="task_item", entity_id=11)
    _notification(db, user=bob, entity_type="task_item", entity_id=12)

    assert notification_service.count_unread_task_notifications(db, alice) == 2
    assert notification_service.count_unread_task_notifications(db, bob) == 1


def test_count_unread_task_notifications_supports_overview_and_tasks_badge_parity(db):
    """Resumen and Tareas consume the same unread task alert count."""
    company = _company(db, "ParityAlerts")
    user = _user(db, company, "parity@alerts.test")

    _notification(db, user=user, entity_type="task_item", entity_id=21)
    _notification(db, user=user, entity_type="task_item", entity_id=22)
    _notification(
        db,
        user=user,
        entity_type="task_item",
        entity_id=23,
        event_type="task.reported",
    )

    overview_count = notification_service.count_unread_task_notifications(db, user)
    tasks_count = notification_service.count_unread_task_notifications(db, user)

    assert overview_count == 3
    assert tasks_count == overview_count


def test_list_unread_task_notifications_returns_only_unread_tasks(db):
    company = _company(db, "ListAlerts")
    user = _user(db, company, "list@alerts.test")

    unread_a = _notification(db, user=user, entity_type="task_item", entity_id=31)
    unread_b = _notification(db, user=user, entity_type="task_item", entity_id=32)
    _notification(
        db,
        user=user,
        entity_type="task_item",
        entity_id=33,
        read_at=datetime.now(timezone.utc),
    )
    _notification(db, user=user, entity_type="reservation", entity_id=34)

    items = notification_service.list_unread_task_notifications(db, user)

    assert [item.id for item in items] == [unread_b.id, unread_a.id]
    assert all(item.entity_type == "task_item" for item in items)
    assert all(item.read_at is None for item in items)
