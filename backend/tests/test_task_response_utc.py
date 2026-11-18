from datetime import datetime, timedelta, timezone

import pytest

from app.models.task_item import TaskItem
from app.schemas.task_item import TaskItemResponse
from app.schemas.work_order import WorkOrderResponse
from app.schemas.work_session import WorkSessionResponse
from test_task_structure import _company, _headers, _location, _user


@pytest.mark.parametrize("stamp", [datetime(2026,11,17,12), datetime(2026,11,17,13,tzinfo=timezone(timedelta(hours=1)))])
def test_work_session_timer_instants_are_explicit_utc(stamp):
    response=WorkSessionResponse(id=1,user_id=1,location_id=1,start_time=stamp,end_time=stamp,paused_at=stamp,created_at=stamp,updated_at=stamp).model_dump(mode="json")
    for field in ("start_time","end_time","paused_at","created_at","updated_at"):
        assert response[field]=="2026-11-17T12:00:00Z"


@pytest.mark.parametrize(("value", "expected"), [
    (datetime(2026, 11, 17, 12), "2026-11-17T12:00:00Z"),
    (datetime(2026, 11, 17, 13, tzinfo=timezone(timedelta(hours=1))), "2026-11-17T12:00:00Z"),
    (datetime(2026, 11, 17), "2026-11-17T00:00:00Z"),
    (datetime(2026, 11, 17, 22, 59, 59, 999000), "2026-11-17T22:59:59.999000Z"),
])
def test_task_response_emits_utc_instants_without_changing_date_only_markers(value, expected):
    response = TaskItemResponse.model_validate({
        "id": 1, "title": "Servicio", "unit": "servicio", "location_id": 1,
        "status": "pending", "is_invoiced": False,
        "scheduled_start_at": value, "due_at": value,
        "created_at": value, "updated_at": value,
    }).model_dump(mode="json")
    for field in ("scheduled_start_at", "due_at", "created_at", "updated_at"):
        assert response[field] == expected
    assert response["date_done"] is None


def test_work_order_response_normalizes_all_database_instants_to_utc():
    stamp = datetime(2026, 11, 17, 12)
    response = WorkOrderResponse.model_validate({
        "id": 1, "title": "Servicio", "description": None, "status": "active",
        "order_type": "recurring", "location_id": 1, "service_contract_id": None,
        "scheduled_start_at": stamp, "next_occurrence_at": stamp,
        "recurrence_unit": "weekly", "recurrence_interval": 1, "recurrence_ends_at": stamp,
        "estimated_people": 1, "estimated_minutes": 40,
        "created_at": stamp, "updated_at": stamp,
    }).model_dump(mode="json")
    for field in ("scheduled_start_at", "next_occurrence_at", "recurrence_ends_at", "created_at", "updated_at"):
        assert response[field] == "2026-11-17T12:00:00Z"


def test_sqlite_task_and_order_read_responses_share_the_same_utc_schedule(client, db):
    company = _company(db, "UtcSchedule")
    admin = _user(db, company, "admin@utc-schedule.test", 1)
    site = _location(db, company)
    task = TaskItem(
        title="Servicio a las 13:00 de Madrid", unit="servicio", status="pending",
        company_id=company.id, location_id=site.id,
        scheduled_start_at=datetime(2026, 11, 17, 12), due_at=datetime(2026, 11, 17, 12, 40),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    assert task.scheduled_start_at.tzinfo is None  # SQLite loses timezone metadata.
    headers = _headers(admin)
    single = client.get(f"/api/v1/task-items/{task.id}", headers=headers)
    assert single.status_code == 200, single.text
    assert single.json()["scheduled_start_at"] == "2026-11-17T12:00:00Z"
    assert single.json()["due_at"] == "2026-11-17T12:40:00Z"
    listed = client.get("/api/v1/task-items/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert next(row for row in listed.json() if row["id"] == task.id)["scheduled_start_at"] == single.json()["scheduled_start_at"]
    created = client.post("/api/v1/work-orders/", headers=headers, json={
        "title": "Mismo servicio", "location_id": site.id, "status": "active",
        "order_type": "one_off", "scheduled_start_at": "2026-11-17T12:00:00Z",
    })
    assert created.status_code == 201, created.text
    assert created.json()["scheduled_start_at"] == single.json()["scheduled_start_at"]
    order = client.get(f"/api/v1/work-orders/{created.json()['id']}", headers=headers)
    assert order.status_code == 200, order.text
    assert order.json()["scheduled_start_at"] == single.json()["scheduled_start_at"]
