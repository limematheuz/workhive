import pytest

from app.models.task_item import TaskItem
from tests.test_reservation_status_contract import _setup


@pytest.mark.parametrize("with_active_stay", [False, True])
def test_importing_cancelled_stay_neither_occupies_dates_nor_creates_cleaning(client, db, with_active_stay):
    headers, payload = _setup(db)
    if with_active_stay:
        active = client.post("/api/v1/reservations/", headers=headers, json=payload)
        assert active.status_code == 201, active.text
    created = client.post("/api/v1/reservations/", headers=headers, json={
        **payload, "status": "cancelled", "cleaning_required": True,
    })
    assert created.status_code == 201, created.text
    reservation = created.json()
    assert reservation["status"] == "cancelled"
    assert reservation["service_request_sent_at"] is None
    assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation["id"]).count() == 0
    url = f"/api/v1/reservations/{reservation['id']}"
    reactivated = client.patch(url, headers=headers, json={"status": "confirmed"})
    if with_active_stay:
        assert reactivated.status_code == 409, reactivated.text
        assert client.get(url, headers=headers).json()["status"] == "cancelled"
        assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation["id"]).count() == 0
    else:
        assert reactivated.status_code == 200, reactivated.text
        assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation["id"]).count() == 1
