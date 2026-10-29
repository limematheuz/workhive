from datetime import datetime, timezone

import pytest

from tests.test_reservations import _company, _headers, _location, _user


@pytest.mark.parametrize("check_out", ["2027-01-04T12:00:00", "2027-01-04T14:00:00+02:00"])
def test_reservation_dates_use_utc_for_mixed_inputs_and_partial_updates(client, db, check_out):
    company = _company(db, "QA date handling", "QADATES")
    company.subscription_status = "active"
    location = _location(db, company)
    admin = _user(db, company, 1, "qa-dates@example.test")
    db.commit()
    headers = _headers(admin)
    created = client.post("/api/v1/reservations/", headers=headers, json={
        "location_id": location.id, "check_in_at": "2027-01-01T14:00:00+02:00",
        "check_out_at": check_out, "cleaning_required": False,
    })
    assert created.status_code == 201, created.text
    url = f"/api/v1/reservations/{created.json()['id']}"
    updated = client.patch(url, headers=headers, json={"check_out_at": "2027-01-05T14:00:00+02:00"})
    assert updated.status_code == 200, updated.text
    instant = datetime.fromisoformat(updated.json()["check_out_at"])
    assert instant.replace(tzinfo=timezone.utc) == datetime(2027, 1, 5, 12, tzinfo=timezone.utc)
    next_stay = client.post("/api/v1/reservations/", headers=headers, json={
        "location_id": location.id, "check_in_at": "2027-01-06T12:00:00Z",
        "check_out_at": "2027-01-07T12:00:00Z", "cleaning_required": False,
    })
    assert next_stay.status_code == 201, next_stay.text
    cleaning = client.patch(url, headers=headers, json={"cleaning_scheduled_at": "2027-01-06T13:00:00+02:00"})
    assert cleaning.status_code == 200, cleaning.text
    rejected_cleaning = client.patch(url, headers=headers, json={"cleaning_scheduled_at": "2027-01-06T15:00:00+02:00"})
    assert rejected_cleaning.status_code == 422, rejected_cleaning.text
    original = client.get(url, headers=headers).json()
    rejected = client.patch(url, headers=headers, json={"check_in_at": "2027-01-06T12:00:00Z"})
    assert rejected.status_code == 422, rejected.text
    assert client.get(url, headers=headers).json() == original


def test_public_reservation_mixed_offsets_compare_instants():
    from pydantic import ValidationError
    from app.schemas.public_api import PublicReservationUpsert

    payload = dict(location_id=1, check_in_at="2027-01-01T14:00:00+02:00", check_out_at="2027-01-02T12:00:00")
    parsed = PublicReservationUpsert(**payload)
    assert parsed.check_in_at == datetime(2027, 1, 1, 12, tzinfo=timezone.utc)
    assert parsed.check_out_at == datetime(2027, 1, 2, 12, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        PublicReservationUpsert(**{**payload, "check_out_at": "2027-01-01T13:00:00+02:00"})
