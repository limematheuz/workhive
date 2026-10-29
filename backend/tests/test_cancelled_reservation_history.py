import pytest

from app.models.task_item import TaskItem
from tests.test_reservations import _company, _headers, _location, _user


@pytest.mark.parametrize("history_patch", [{"notes": "QA history note"}, {"status": "cancelled"}])
def test_cancelled_stay_can_be_annotated_without_conflicting_with_replacement(client, db, history_patch):
    company = _company(db, "QA cancellation history", "QACANCELHISTORY")
    company.subscription_status = "active"
    location = _location(db, company)
    admin = _user(db, company, 1, "qa-cancel-history@example.test")
    db.commit()
    headers = _headers(admin)
    payload = {
        "location_id": location.id, "check_in_at": "2027-03-01T12:00:00Z",
        "check_out_at": "2027-03-03T12:00:00Z", "cleaning_required": True,
    }
    created = client.post("/api/v1/reservations/", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    reservation_id = created.json()["id"]
    url = f"/api/v1/reservations/{reservation_id}"
    cancelled = client.patch(url, headers=headers, json={"status": "cancelled"})
    assert cancelled.status_code == 200, cancelled.text
    assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).count() == 0
    replacement = client.post("/api/v1/reservations/", headers=headers, json=payload)
    assert replacement.status_code == 201, replacement.text
    replacement_url = f"/api/v1/reservations/{replacement.json()['id']}"
    replacement_original = client.get(replacement_url, headers=headers).json()
    annotated = client.patch(url, headers=headers, json=history_patch)
    assert annotated.status_code == 200, annotated.text
    assert annotated.json()["status"] == "cancelled"
    for key, value in history_patch.items():
        assert annotated.json()[key] == value
    assert client.patch(url, headers=headers, json={"status": "confirmed"}).status_code == 409
    assert client.get(url, headers=headers).json()["status"] == "cancelled"
    assert client.get(replacement_url, headers=headers).json() == replacement_original
    assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).count() == 0
    assert db.query(TaskItem).filter_by(checkout_reservation_id=replacement.json()["id"]).count() == 1
    assert client.patch(replacement_url, headers=headers, json={"status": "cancelled"}).status_code == 200
    reactivated = client.patch(url, headers=headers, json={"status": "confirmed"})
    assert reactivated.status_code == 200, reactivated.text
    assert reactivated.json()["id"] == reservation_id
    assert db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).count() == 1
    assert db.query(TaskItem).filter_by(checkout_reservation_id=replacement.json()["id"]).count() == 0
