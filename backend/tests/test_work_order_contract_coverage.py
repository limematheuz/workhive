from datetime import datetime

import pytest

from app.models.audit_log import AuditLog
from app.models.service_contract import ServiceContract
from app.models.task_item import TaskItem
from test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location
from test_work_orders import _active_contract


@pytest.mark.parametrize("invalidated", ["coverage_removed", "contract_draft", "contract_terminated"])
def test_generation_rechecks_contract_coverage_without_losing_previous_work(client, db, invalidated):
    company = _company(db, "execution-coverage")
    owner = _bootstrap_admin(db, company, "execution-coverage-owner")
    headers = _headers(owner)
    customer = _client(client, headers)
    location = _location(client, headers, customer["id"])
    contract = _active_contract(client, headers, customer["id"], location["id"])
    created = client.post("/api/v1/work-orders/", headers=headers, json={
        "title": "Contract execution coverage",
        "location_id": location["id"],
        "service_contract_id": contract["id"],
        "status": "active",
        "order_type": "recurring",
        "scheduled_start_at": "2030-05-01T09:00:00Z",
        "recurrence_unit": "weekly",
        "recurrence_interval": 1,
    })
    assert created.status_code == 201, created.text
    path = f"/api/v1/work-orders/{created.json()['id']}"
    first = client.post(f"{path}/generate", headers=headers)
    assert first.status_code == 200, first.text
    previous = first.json()["work_order"]
    first_task_id = first.json()["task_item_id"]
    contract_path = f"/api/v1/service-contracts/{contract['id']}"
    if invalidated == "coverage_removed":
        retired = client.delete(f"{contract_path}/locations/{location['id']}", headers=headers)
        assert retired.status_code == 200, retired.text
        assert retired.json()["covered_locations"][0]["is_active"] is False
    else:
        # Represent persisted contract states that may outlive a planned order.
        db.get(ServiceContract, contract["id"]).status = invalidated.removeprefix("contract_")
        db.commit()
    foreign_company = _company(db, "execution-foreign")
    foreign_headers = _headers(_bootstrap_admin(db, foreign_company, "execution-foreign-owner"))
    audit_count = db.query(AuditLog).count()
    assert client.post(f"{path}/generate", headers=foreign_headers).status_code == 404
    assert client.post(f"{path}/generate").status_code == 401
    denied = client.post(f"{path}/generate", headers=headers)
    assert denied.status_code == 422, denied.text
    assert "contrato" in denied.json()["detail"].lower()
    persisted = client.get(path, headers=headers)
    assert persisted.status_code == 200, persisted.text
    assert persisted.json() == previous
    assert db.query(TaskItem).count() == 1
    first_task = db.get(TaskItem, first_task_id)
    assert first_task.status == "pending"
    assert first_task.scheduled_start_at == datetime(2030, 5, 1, 9)
    assert first_task.work_order_id == previous["id"]
    assert db.query(AuditLog).count() == audit_count

    if invalidated == "coverage_removed":
        restored = client.post(f"{contract_path}/locations", headers=headers, json={"location_ids": [location["id"]]})
        assert restored.status_code == 200, restored.text
        assert restored.json()["covered_locations"] == contract["covered_locations"]
    else:
        db.get(ServiceContract, contract["id"]).status = "active"
        db.commit()
    resumed = client.post(f"{path}/generate", headers=headers)
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["task_item_id"] != first_task_id
    assert db.query(TaskItem).count() == 2
    next_task = db.get(TaskItem, resumed.json()["task_item_id"])
    assert next_task.scheduled_start_at == datetime(2030, 5, 8, 9)
    assert next_task.work_order_id == previous["id"]
    assert resumed.json()["work_order"]["next_occurrence_at"].startswith("2030-05-15T09:00:00")
    unchanged_contract = client.get(contract_path, headers=headers)
    assert unchanged_contract.status_code == 200, unchanged_contract.text
    for field in ("client_id", "source_quote_id", "source_quote_revision_id", "quote_snapshot", "service_lines", "covered_locations"):
        assert unchanged_contract.json()[field] == contract[field]
