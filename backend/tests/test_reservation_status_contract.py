import pytest

from app.models.reservation import Reservation
from tests.test_reservations import _company, _headers, _location, _user


def _setup(db):
    company = _company(db, "QA reservation status", "QASTATUS")
    company.subscription_status = "active"
    location = _location(db, company)
    admin = _user(db, company, 1, "qa-status@example.test")
    db.commit()
    return _headers(admin), {
        "location_id": location.id, "check_in_at": "2027-04-01T12:00:00Z",
        "check_out_at": "2027-04-03T12:00:00Z", "cleaning_required": False,
    }


@pytest.mark.parametrize("invalid_status", ["", "cancelled ", "canceled", "archived"])
def test_reservation_rejects_unknown_status_on_create_and_update(client, db, invalid_status):
    headers, payload = _setup(db)
    rejected = client.post("/api/v1/reservations/", headers=headers, json={**payload, "status": invalid_status})
    assert rejected.status_code == 422, rejected.text
    assert db.query(Reservation).count() == 0
    created = client.post("/api/v1/reservations/", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    original = created.json()
    url = f"/api/v1/reservations/{original['id']}"
    rejected = client.patch(url, headers=headers, json={"status": invalid_status, "notes": "must not persist"})
    assert rejected.status_code == 422, rejected.text
    assert client.get(url, headers=headers).json() == original


@pytest.mark.parametrize("allowed_status", ["confirmed", "tentative", "cancelled"])
def test_reservation_keeps_supported_statuses(client, db, allowed_status):
    headers, payload = _setup(db)
    created = client.post("/api/v1/reservations/", headers=headers, json={**payload, "status": allowed_status})
    assert created.status_code == 201, created.text
    assert created.json()["status"] == allowed_status
    url = f"/api/v1/reservations/{created.json()['id']}"
    updated = client.patch(url, headers=headers, json={"status": allowed_status})
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == allowed_status
