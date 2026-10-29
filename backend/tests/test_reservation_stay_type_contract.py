import pytest

from app.models.reservation import Reservation
from tests.test_reservation_status_contract import _setup


@pytest.mark.parametrize("invalid_type", ["", "holiday", "guest "])
def test_reservation_rejects_unknown_stay_types_without_mutation(client, db, invalid_type):
    headers, payload = _setup(db)
    rejected = client.post("/api/v1/reservations/", headers=headers, json={**payload, "stay_type": invalid_type})
    assert rejected.status_code == 422, rejected.text
    assert db.query(Reservation).count() == 0
    created = client.post("/api/v1/reservations/", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    original = created.json()
    url = f"/api/v1/reservations/{original['id']}"
    rejected = client.patch(url, headers=headers, json={"stay_type": invalid_type, "notes": "must not persist"})
    assert rejected.status_code == 422, rejected.text
    assert client.get(url, headers=headers).json() == original


@pytest.mark.parametrize("stay_type", ["guest", "owner", "block"])
def test_reservation_keeps_supported_stay_types(client, db, stay_type):
    headers, payload = _setup(db)
    created = client.post("/api/v1/reservations/", headers=headers, json={**payload, "stay_type": stay_type})
    assert created.status_code == 201, created.text
    assert created.json()["stay_type"] == stay_type
    url = f"/api/v1/reservations/{created.json()['id']}"
    updated = client.patch(url, headers=headers, json={"stay_type": stay_type})
    assert updated.status_code == 200, updated.text
    assert updated.json()["stay_type"] == stay_type


@pytest.mark.parametrize("invalid_type", ["", "holiday", "guest "])
def test_public_reservation_rejects_unknown_stay_types(invalid_type):
    from pydantic import ValidationError
    from app.schemas.public_api import PublicReservationUpsert

    with pytest.raises(ValidationError):
        PublicReservationUpsert(
            location_id=1, check_in_at="2027-04-01T12:00:00Z",
            check_out_at="2027-04-03T12:00:00Z", stay_type=invalid_type,
        )
