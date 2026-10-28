from datetime import datetime

import pytest

from app.models.audit_log import AuditLog
from app.models.task_item import TaskItem
from test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location
from test_work_orders import _active_contract


@pytest.mark.parametrize("terms, allowed", [
    ({"starts_at": "2030-05-08T09:00:01Z"}, False),
    ({"starts_at": "2030-05-08T09:00:01"}, False),
    ({"ends_at": "2030-05-08T08:59:59Z", "renewal_mode": "manual"}, False),
    ({"ends_at": "2030-05-08T08:59:59Z", "renewal_mode": "automatic"}, False),
    ({"starts_at": "2030-05-08T11:00:00+02:00"}, True),
    ({"ends_at": "2030-05-08T11:00:00+02:00"}, True),
    ({"starts_at": "2030-05-08T09:00:00", "ends_at": "2030-05-08T09:00:00"}, True),
    ({"starts_at": None, "ends_at": None}, True),
])
def test_generation_respects_current_contract_dates_and_preserves_previous_work(client, db, terms, allowed):
    company = _company(db, "contract-validity")
    headers = _headers(_bootstrap_admin(db, company, "contract-validity-owner"))
    customer = _client(client, headers)
    location = _location(client, headers, customer["id"])
    contract = _active_contract(client, headers, customer["id"], location["id"])
    created = client.post("/api/v1/work-orders/", headers=headers, json={
        "title": "Contract validity QA", "location_id": location["id"],
        "service_contract_id": contract["id"], "status": "active", "order_type": "recurring",
        "scheduled_start_at": "2030-05-01T09:00:00Z", "recurrence_unit": "weekly", "recurrence_interval": 1,
    })
    assert created.status_code == 201, created.text
    path = f"/api/v1/work-orders/{created.json()['id']}"
    first = client.post(f"{path}/generate", headers=headers)
    assert first.status_code == 200, first.text
    previous = first.json()["work_order"]
    first_task_id = first.json()["task_item_id"]
    contract_path = f"/api/v1/service-contracts/{contract['id']}"
    saved = client.patch(contract_path, headers=headers, json=terms)
    assert saved.status_code == 200, saved.text
    foreign = _company(db, "contract-validity-foreign")
    foreign_headers = _headers(_bootstrap_admin(db, foreign, "contract-validity-foreign-owner"))
    audit_count = db.query(AuditLog).count()
    assert client.post(f"{path}/generate").status_code == 401
    assert client.post(f"{path}/generate", headers=foreign_headers).status_code == 404
    result = client.post(f"{path}/generate", headers=headers)
    assert result.status_code == (200 if allowed else 422), result.text
    if not allowed:
        assert "vigencia" in result.json()["detail"].lower()
        assert client.get(path, headers=headers).json() == previous
        assert db.query(TaskItem).count() == 1
        assert db.query(AuditLog).count() == audit_count
        # Extending the actual persisted term, rather than a renewal flag, permits retry.
        extended = client.patch(contract_path, headers=headers, json={
            "starts_at": "2030-05-01T09:00:00Z", "ends_at": "2030-05-15T09:00:00Z",
        })
        assert extended.status_code == 200, extended.text
        result = client.post(f"{path}/generate", headers=headers)
        assert result.status_code == 200, result.text
    assert db.query(TaskItem).count() == 2
    original = db.get(TaskItem, first_task_id)
    assert original.status == "pending"
    assert original.scheduled_start_at == datetime(2030, 5, 1, 9)
    generated = db.get(TaskItem, result.json()["task_item_id"])
    assert generated.id != first_task_id
    assert generated.work_order_id == previous["id"]
    assert generated.scheduled_start_at == datetime(2030, 5, 8, 9)
    assert result.json()["work_order"]["next_occurrence_at"].startswith("2030-05-15T09:00:00")
    persisted = client.get(contract_path, headers=headers).json()
    for field in ("status", "quote_snapshot", "service_lines", "covered_locations", "source_quote_id", "source_quote_revision_id"):
        assert persisted[field] == contract[field]
