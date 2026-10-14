from datetime import datetime

from app.models.task_item import TaskItem
from tests.test_service_contracts import (
    _accepted_quote,
    _authenticated_company,
    _client,
    _location,
)


def _active_contract(client, headers, customer_id: int, location_id: int):
    _accepted_quote(client, headers, customer_id)
    contract = client.get("/api/v1/service-contracts/", headers=headers).json()[0]
    attached = client.post(
        f"/api/v1/service-contracts/{contract['id']}/locations",
        headers=headers,
        json={"location_ids": [location_id]},
    )
    assert attached.status_code == 200, attached.text
    activated = client.post(
        f"/api/v1/service-contracts/{contract['id']}/activate",
        headers=headers,
    )
    assert activated.status_code == 200, activated.text
    return activated.json()


def test_recurring_work_order_creates_traceable_task_instances(client, db):
    owner_headers = _authenticated_company(
        client,
        email="work-orders-owner@example.com",
        name="Órdenes Owner",
        tax_id="B10000061",
    )
    other_headers = _authenticated_company(
        client,
        email="work-orders-other@example.com",
        name="Órdenes Ajeno",
        tax_id="B10000062",
    )
    customer = _client(client, owner_headers, name="Cliente de órdenes")
    location = _location(client, owner_headers, customer["id"])
    contract = _active_contract(client, owner_headers, customer["id"], location["id"])

    created = client.post(
        "/api/v1/work-orders/",
        headers=owner_headers,
        json={
            "title": "Limpieza semanal",
            "location_id": location["id"],
            "service_contract_id": contract["id"],
            "status": "active",
            "order_type": "recurring",
            "scheduled_start_at": "2026-10-01T09:00:00+00:00",
            "recurrence_unit": "weekly",
            "recurrence_interval": 2,
            "estimated_people": 2,
            "estimated_minutes": 120,
        },
    )
    assert created.status_code == 201, created.text
    work_order = created.json()
    assert work_order["next_occurrence_at"].startswith("2026-10-01T09:00:00")

    candidates = client.get("/api/v1/work-orders/contract-candidates", headers=owner_headers)
    assert candidates.status_code == 200, candidates.text
    assert candidates.json() == [
        {
            "contract_id": contract["id"],
            "contract_title": contract["title"],
            "location_id": location["id"],
            "location_name": location["name"],
        }
    ]

    assert client.get(
        f"/api/v1/work-orders/{work_order['id']}", headers=other_headers
    ).status_code == 404
    generated = client.post(
        f"/api/v1/work-orders/{work_order['id']}/generate", headers=owner_headers
    )
    assert generated.status_code == 200, generated.text
    assert generated.json()["work_order"]["next_occurrence_at"].startswith("2026-10-15T09:00:00")
    task = db.get(TaskItem, generated.json()["task_item_id"])
    assert task is not None
    assert task.work_order_id == work_order["id"]
    assert task.scheduled_start_at == datetime(2026, 10, 1, 9, 0)

    rescheduled = client.patch(
        f"/api/v1/work-orders/{work_order['id']}",
        headers=owner_headers,
        json={"next_occurrence_at": "2026-10-20T09:00:00+00:00"},
    )
    assert rescheduled.status_code == 200, rescheduled.text
    assert rescheduled.json()["scheduled_start_at"].startswith("2026-10-01T09:00:00")
    assert rescheduled.json()["next_occurrence_at"].startswith("2026-10-20T09:00:00")

    rescheduled_generation = client.post(
        f"/api/v1/work-orders/{work_order['id']}/generate", headers=owner_headers
    )
    assert rescheduled_generation.status_code == 200, rescheduled_generation.text
    assert rescheduled_generation.json()["work_order"]["next_occurrence_at"].startswith("2026-11-03T09:00:00")
    rescheduled_task = db.get(TaskItem, rescheduled_generation.json()["task_item_id"])
    assert rescheduled_task is not None
    assert rescheduled_task.scheduled_start_at == datetime(2026, 10, 20, 9, 0)


def test_one_off_work_order_stays_separate_until_it_generates_a_task(client, db):
    headers = _authenticated_company(
        client,
        email="work-orders-one-off@example.com",
        name="Órdenes Únicas",
        tax_id="B10000063",
    )
    customer = _client(client, headers, name="Cliente puntual")
    location = _location(client, headers, customer["id"])

    created = client.post(
        "/api/v1/work-orders/",
        headers=headers,
        json={
            "title": "Limpieza puntual",
            "location_id": location["id"],
            "status": "active",
            "scheduled_start_at": "2026-10-02T09:00:00+00:00",
        },
    )
    assert created.status_code == 201, created.text
    work_order = created.json()
    assert db.query(TaskItem).count() == 0

    assert client.patch(
        f"/api/v1/work-orders/{work_order['id']}",
        headers=headers,
        json={"next_occurrence_at": "2026-10-03T09:00:00+00:00"},
    ).status_code == 422

    generated = client.post(
        f"/api/v1/work-orders/{work_order['id']}/generate", headers=headers
    )
    assert generated.status_code == 200, generated.text
    assert generated.json()["work_order"]["status"] == "completed"
    assert generated.json()["work_order"]["next_occurrence_at"] is None
