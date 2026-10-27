from datetime import datetime, timezone

import pytest

from app.models.task_item import TaskItem
from test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location


@pytest.fixture()
def recurring_order(client, db):
    company = _company(db, "order-lifecycle")
    owner = _bootstrap_admin(db, company, "order-lifecycle-owner")
    headers = _headers(owner)
    customer = _client(client, headers)
    location = _location(client, headers, customer["id"])
    created = client.post("/api/v1/work-orders/", headers=headers, json={
        "title": "Lifecycle regression",
        "location_id": location["id"],
        "status": "active",
        "order_type": "recurring",
        "scheduled_start_at": "2026-10-01T09:00:00Z",
        "recurrence_unit": "weekly",
        "recurrence_interval": 1,
        "recurrence_ends_at": "2026-10-15T09:00:00Z",
    })
    assert created.status_code == 201, created.text
    return headers, f"/api/v1/work-orders/{created.json()['id']}", created.json()


def _instant(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def test_pausing_and_resuming_preserves_occurrence_and_existing_tasks(client, db, recurring_order):
    headers, path, original = recurring_order
    first = client.post(f"{path}/generate", headers=headers)
    assert first.status_code == 200, first.text
    task_id = first.json()["task_item_id"]
    next_at = first.json()["work_order"]["next_occurrence_at"]
    paused = client.patch(path, headers=headers, json={"status": "paused"})
    assert paused.status_code == 200, paused.text
    assert paused.json()["next_occurrence_at"] == next_at
    blocked = client.post(f"{path}/generate", headers=headers)
    assert blocked.status_code == 409, blocked.text
    assert client.get(path, headers=headers).json() == paused.json()
    assert db.query(TaskItem).count() == 1
    assert db.get(TaskItem, task_id).status == "pending"
    resumed = client.patch(path, headers=headers, json={"status": "active"})
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["next_occurrence_at"] == next_at
    second = client.post(f"{path}/generate", headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["task_item_id"] != task_id
    assert db.query(TaskItem).count() == 2
    task = db.get(TaskItem, second.json()["task_item_id"])
    assert task.scheduled_start_at == _instant(next_at).replace(tzinfo=None)
    assert second.json()["work_order"]["scheduled_start_at"] == original["scheduled_start_at"]


def test_partial_replanning_with_offset_respects_persisted_recurrence_end(client, db, recurring_order):
    headers, path, original = recurring_order
    moved = client.patch(path, headers=headers, json={"next_occurrence_at": "2026-10-08T11:00:00+02:00"})
    assert moved.status_code == 200, moved.text
    assert _instant(moved.json()["next_occurrence_at"]) == datetime(2026, 10, 8, 9, tzinfo=timezone.utc)
    assert moved.json()["scheduled_start_at"] == original["scheduled_start_at"]
    assert moved.json()["recurrence_ends_at"] == original["recurrence_ends_at"]
    rejected = client.patch(path, headers=headers, json={"next_occurrence_at": "2026-10-15T09:00:01Z"})
    assert rejected.status_code == 422, rejected.text
    assert client.get(path, headers=headers).json() == moved.json()
    assert db.query(TaskItem).count() == 0
    final = client.patch(path, headers=headers, json={"next_occurrence_at": "2026-10-15T11:00:00+02:00"})
    assert final.status_code == 200, final.text
    generated = client.post(f"{path}/generate", headers=headers)
    assert generated.status_code == 200, generated.text
    assert generated.json()["work_order"]["status"] == "completed"
    assert generated.json()["work_order"]["next_occurrence_at"] is None
    assert db.query(TaskItem).count() == 1
    assert client.post(f"{path}/generate", headers=headers).status_code == 409
    assert db.query(TaskItem).count() == 1


@pytest.mark.parametrize("state", ["draft", "cancelled", "completed"])
def test_inactive_order_never_generates_or_removes_recorded_tasks(client, db, recurring_order, state):
    headers, path, _ = recurring_order
    generated = client.post(f"{path}/generate", headers=headers)
    assert generated.status_code == 200, generated.text
    task_id = generated.json()["task_item_id"]
    saved = client.patch(path, headers=headers, json={"status": state})
    assert saved.status_code == 200, saved.text
    assert client.post(f"{path}/generate", headers=headers).status_code == 409
    assert client.get(path, headers=headers).json() == saved.json()
    assert db.query(TaskItem).count() == 1
    assert db.get(TaskItem, task_id).work_order_id == saved.json()["id"]


@pytest.mark.parametrize("payload", [
    {"recurrence_ends_at": "2026-09-30T11:00:00+02:00"},
    {"scheduled_start_at": "2026-10-16T09:00:00Z"},
])
def test_invalid_partial_date_range_returns_validation_error_without_changes(client, db, recurring_order, payload):
    headers, path, original = recurring_order
    rejected = client.patch(path, headers=headers, json=payload)
    assert rejected.status_code == 422, rejected.text
    assert client.get(path, headers=headers).json() == original
    assert db.query(TaskItem).count() == 0


@pytest.mark.parametrize("payload,field,expected", [
    ({"recurrence_ends_at": "2026-10-22T11:00:00+02:00"}, "recurrence_ends_at", "2026-10-22T09:00:00Z"),
    ({"scheduled_start_at": "2026-10-02T11:00:00+02:00"}, "scheduled_start_at", "2026-10-02T09:00:00Z"),
    ({"next_occurrence_at": "2026-10-08T09:00:00"}, "next_occurrence_at", "2026-10-08T09:00:00Z"),
])
def test_partial_date_updates_keep_the_exact_instant(client, recurring_order, payload, field, expected):
    headers, path, _ = recurring_order
    updated = client.patch(path, headers=headers, json=payload)
    assert updated.status_code == 200, updated.text
    assert _instant(updated.json()[field]) == _instant(expected)
    persisted = client.get(path, headers=headers)
    assert persisted.status_code == 200, persisted.text
    assert _instant(persisted.json()[field]) == _instant(expected)
