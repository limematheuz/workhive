import pytest

from app.models.notification import Notification
from app.models.task_report import TaskReport
from app.repositories import async_task_report as repository
from tests.test_task_notifications import _external_task, _headers
from tests.test_task_report_center import _accept_external_task, _report_payload


@pytest.mark.parametrize("kind", ["note", "photo"])
def test_duplicate_insert_after_initial_lookup_returns_existing_report(
    client, db, monkeypatch, kind
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    payload = _report_payload(
        task.id,
        report_type=kind,
        title=None,
        description="QA retry",
        issue_type=None,
        element=None,
    )
    deleted = []
    copies = iter(["copy-original", "copy-retry"])
    monkeypatch.setattr(
        "app.services.task_report_service.copy_report_media",
        lambda *_: next(copies) if kind == "photo" else None,
    )
    monkeypatch.setattr(
        "app.services.task_report_service._delete_media_keys",
        lambda keys: deleted.extend(keys),
    )
    if kind == "photo":
        payload.update(media_url="/uploads/qa.png", file_name="qa.png")
    headers = _headers(users["receiver_viewer"])
    first = client.post("/api/v1/task-reports/", headers=headers, json=payload)
    assert first.status_code == 201, first.text
    notices = db.query(Notification).count()
    original_lookup = repository.get_by_user_event
    calls = 0

    async def stale_initial_lookup(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            return None
        return await original_lookup(*args, **kwargs)

    monkeypatch.setattr(repository, "get_by_user_event", stale_initial_lookup)
    retry = client.post("/api/v1/task-reports/", headers=headers, json=payload)
    assert retry.status_code == 201, retry.text
    assert retry.json() == first.json()
    assert db.query(TaskReport).count() == 1
    assert db.query(Notification).count() == notices
    assert deleted == (["copy-retry"] if kind == "photo" else [])
