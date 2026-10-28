import asyncio

import pytest

from app.models.notification import Notification
from app.services import notification_service
from conftest import AsyncSessionAdapter
from test_client_permission_authorization import _bootstrap_admin, _company, _headers


def _inbox(db):
    company = _company(db, "inbox-current")
    old_company = _company(db, "inbox-previous")
    owner = _bootstrap_admin(db, company, "inbox-owner")
    colleague = _bootstrap_admin(db, company, "inbox-colleague")
    foreign = _bootstrap_admin(db, old_company, "inbox-foreign")
    notification_service.notify_users(
        db,
        users=[owner, owner, colleague, foreign],
        event_type="qa.inbox",
        title="QA inbox",
        message="Controlled notification",
        entity_type="task_item",
        entity_id=47,
        href="/dashboard",
    )
    current = (
        db.query(Notification).filter_by(user_id=owner.id, company_id=company.id).one()
    )
    historical = Notification(
        user_id=owner.id,
        company_id=old_company.id,
        event_type="qa.inbox",
        title="Historical company notice",
        message="Private previous context",
        entity_type="task_item",
        entity_id=47,
        href="/dashboard",
    )
    db.add(historical)
    db.commit()
    assert db.query(Notification).count() == 4
    return owner, colleague, foreign, current, historical


@pytest.mark.parametrize("operation", ["single", "all", "task"])
def test_inbox_api_keeps_previous_company_and_other_recipient_notifications_private(
    client, db, operation
):
    owner, colleague, foreign, current, historical = _inbox(db)
    headers = _headers(owner)
    listing = client.get("/api/v1/notifications/?unread_only=false", headers=headers)
    assert listing.status_code == 200, listing.text
    assert [row["id"] for row in listing.json()] == [current.id]
    assert client.get("/api/v1/notifications/").status_code == 401
    assert (
        client.patch(
            f"/api/v1/notifications/{historical.id}/read", headers=headers
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/notifications/{current.id}/read", headers=_headers(colleague)
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/notifications/{current.id}/read", headers=_headers(foreign)
        ).status_code
        == 404
    )
    suffix = {
        "single": f"{current.id}/read",
        "all": "read-all",
        "task": "task-items/47/read",
    }[operation]
    saved = client.patch(f"/api/v1/notifications/{suffix}", headers=headers)
    assert saved.status_code == (200 if operation == "single" else 204), saved.text
    db.expire_all()
    assert db.get(Notification, current.id).read_at is not None
    assert db.get(Notification, historical.id).read_at is None
    assert (
        db.query(Notification)
        .filter(Notification.user_id != owner.id, Notification.read_at.is_not(None))
        .count()
        == 0
    )
    assert client.get("/api/v1/notifications/", headers=headers).json() == []
    history = client.get(
        "/api/v1/notifications/?unread_only=false", headers=headers
    ).json()
    assert [row["id"] for row in history] == [current.id]
    first_read = db.get(Notification, current.id).read_at
    assert (
        client.patch(
            f"/api/v1/notifications/{current.id}/read", headers=headers
        ).status_code
        == 200
    )
    assert db.get(Notification, current.id).read_at == first_read


@pytest.mark.parametrize("operation", ["single", "all", "event"])
def test_sync_inbox_and_event_acknowledgement_share_recipient_and_company_scope(
    db, operation
):
    owner, _, _, current, historical = _inbox(db)
    assert [
        n.id
        for n in notification_service.list_notifications(
            db, owner, unread_only=False, limit=200
        )
    ] == [current.id]
    assert [
        n.id for n in notification_service.list_unread_task_notifications(db, owner)
    ] == [current.id]
    assert notification_service.count_unread_task_notifications(db, owner) == 1
    assert notification_service.mark_read(db, owner, historical.id) is None
    if operation == "single":
        assert notification_service.mark_read(db, owner, current.id).id == current.id
    elif operation == "all":
        notification_service.mark_all_read(db, owner)
    else:
        asyncio.run(
            notification_service.mark_event_read_async(
                AsyncSessionAdapter(db), owner, event_type="qa.inbox"
            )
        )
    db.expire_all()
    assert db.get(Notification, current.id).read_at is not None
    assert db.get(Notification, historical.id).read_at is None
    assert notification_service.count_unread_task_notifications(db, owner) == 0
    assert (
        db.query(Notification)
        .filter(Notification.user_id != owner.id, Notification.read_at.is_not(None))
        .count()
        == 0
    )


@pytest.mark.parametrize(
    "operation",
    [
        "list",
        "tasks",
        "count",
        "single",
        "all",
        "async_list",
        "async_single",
        "async_all",
        "async_task",
        "async_event",
    ],
)
def test_missing_company_context_never_opens_a_global_inbox(db, operation):
    from types import SimpleNamespace
    from fastapi import HTTPException

    user = SimpleNamespace(id=1, company_id=None)
    actions = {
        "list": lambda: notification_service.list_notifications(
            db, user, unread_only=False, limit=200
        ),
        "tasks": lambda: notification_service.list_unread_task_notifications(db, user),
        "count": lambda: notification_service.count_unread_task_notifications(db, user),
        "single": lambda: notification_service.mark_read(db, user, 1),
        "all": lambda: notification_service.mark_all_read(db, user),
        "async_list": lambda: asyncio.run(
            notification_service.list_notifications_async(
                AsyncSessionAdapter(db), user, unread_only=False, limit=200
            )
        ),
        "async_single": lambda: asyncio.run(
            notification_service.mark_read_async(AsyncSessionAdapter(db), user, 1)
        ),
        "async_all": lambda: asyncio.run(
            notification_service.mark_all_read_async(AsyncSessionAdapter(db), user)
        ),
        "async_task": lambda: asyncio.run(
            notification_service.mark_task_item_read_async(
                AsyncSessionAdapter(db), user, task_item_id=47
            )
        ),
        "async_event": lambda: asyncio.run(
            notification_service.mark_event_read_async(
                AsyncSessionAdapter(db), user, event_type="qa.inbox"
            )
        ),
    }
    with pytest.raises(HTTPException) as denied:
        actions[operation]()
    assert denied.value.status_code == 400


def test_inbox_scope_keeps_reads_bounded_to_one_query(db):
    from sqlalchemy import event

    owner, _, _, current, _ = _inbox(db)
    # Resolve ORM attributes before measuring the inbox query itself.
    assert owner.id and owner.company_id
    queries = []

    def record_query(_conn, _cursor, statement, _parameters, _context, _many):
        queries.append(statement)

    event.listen(db.bind, "before_cursor_execute", record_query)
    try:
        rows = notification_service.list_notifications(
            db, owner, unread_only=False, limit=1
        )
        assert [row.id for row in rows] == [current.id]
        assert len(queries) == 1
        queries.clear()
        assert notification_service.count_unread_task_notifications(db, owner) == 1
        assert len(queries) == 1
    finally:
        event.remove(db.bind, "before_cursor_execute", record_query)
