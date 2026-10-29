from datetime import datetime

import pytest

from app.models.task_item import TaskItem
from tests.test_reservation_status_contract import _setup
from tests.test_reservations import _user
from app.models.company import Company


@pytest.mark.parametrize("metadata", [{"notes": "QA note"}, {"source": "qa"}, {"external_reference": "QA-ref"}, {"stay_type": "owner"}, {}, {
    "notes": "QA full form", "check_in_at": "2027-04-01T12:00:00Z",
    "check_out_at": "2027-04-03T12:00:00Z", "guest_count": 1,
    "status": "confirmed", "cleaning_required": True, "assigned_company_id": None,
    "cleaning_scheduled_at": "2027-04-03T15:00:00Z",
}])
def test_reservation_metadata_does_not_reset_existing_cleaning_plan(client, db, metadata):
    headers, payload = _setup(db)
    created = client.post("/api/v1/reservations/", headers=headers, json={**payload, "cleaning_required": True})
    assert created.status_code == 201, created.text
    reservation_id = created.json()["id"]
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).one()
    worker = _user(db, db.get(Company, task.company_id), 3, "qa-plan-worker@example.test")
    task.user_id = worker.id
    task.scheduled_start_at = datetime(2027, 4, 3, 15)
    task.due_at = datetime(2027, 4, 3, 15)
    task.priority = "low"
    db.commit()
    original = (task.id, task.user_id, task.scheduled_start_at, task.due_at, task.priority, task.status)
    response = client.patch(f"/api/v1/reservations/{reservation_id}", headers=headers, json=metadata)
    assert response.status_code == 200, response.text
    for key, value in metadata.items():
        if not key.endswith("_at"):
            assert response.json()[key] == value
    db.refresh(task)
    assert (task.id, task.user_id, task.scheduled_start_at, task.due_at, task.priority, task.status) == original
    assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).count() == 1
