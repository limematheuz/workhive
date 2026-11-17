from datetime import datetime, timezone

from app.models.notification import Notification
from test_notification_inbox_isolation import _inbox
from test_client_permission_authorization import _headers


def test_inbox_pages_do_not_repeat_or_truncate_notifications(client, db):
    user, _, _, current, _ = _inbox(db)
    for index in range(204):
        db.add(
            Notification(
                user_id=user.id,
                company_id=user.company_id,
                event_type="qa.page",
                title="QA",
                message=str(index),
                entity_type="quality",
                entity_id=index,
                href="/dashboard",
            )
        )
    db.commit()
    pages = [
        client.get(
            f"/api/v1/notifications/?limit=200&skip={skip}", headers=_headers(user)
        )
        for skip in (0, 200)
    ]
    assert [response.status_code for response in pages] == [200, 200]
    ids = [row["id"] for response in pages for row in response.json()]
    assert len(ids) == len(set(ids)) == 205
    assert current.id in ids


def test_task_read_state_is_durable_and_scoped_to_recipient_and_company(client, db):
    user, colleague, _, current, historical = _inbox(db)
    current.read_at = datetime.now(timezone.utc)
    historical.read_at = datetime.now(timezone.utc)
    db.commit()
    route = "/api/v1/notifications/task-items/acknowledged"
    assert client.get(route).status_code == 401
    response = client.get(route, headers=_headers(user))
    assert response.status_code == 200, response.text
    assert [row["task_item_id"] for row in response.json()] == [47]
    assert response.json()[0]["read_at"]
    assert client.get(route, headers=_headers(colleague)).json() == []
