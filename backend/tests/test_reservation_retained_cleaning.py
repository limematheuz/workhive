import pytest

from app.models.task_item import TaskItem
from tests.test_reservations import _company, _headers, _location, _user


@pytest.mark.parametrize("cleaning_change", ["omitted", "rescheduled", "reset"])
def test_moving_checkout_reschedules_the_existing_cleaning_task(client, db, cleaning_change):
    company = _company(db, "QA retained cleaning", "QARETAINED")
    company.subscription_status = "active"
    location = _location(db, company)
    admin = _user(db, company, 1, "qa-retained@example.test")
    db.commit()
    headers = _headers(admin)
    created = client.post("/api/v1/reservations/", headers=headers, json={
        "location_id": location.id,
        "check_in_at": "2027-02-01T12:00:00Z",
        "check_out_at": "2027-02-03T12:00:00Z",
        "cleaning_scheduled_at": "2027-02-03T14:00:00Z",
        "cleaning_required": True,
    })
    assert created.status_code == 201, created.text
    url = f"/api/v1/reservations/{created.json()['id']}"
    original = client.get(url, headers=headers).json()
    task = db.query(TaskItem).filter_by(checkout_reservation_id=original["id"]).one()
    previous_task_id = task.id
    patch = {"check_out_at": "2027-02-04T12:00:00Z", "notes": "updated"}
    if cleaning_change != "omitted":
        patch["cleaning_scheduled_at"] = "2027-02-04T15:00:00Z" if cleaning_change == "rescheduled" else None
    response = client.patch(url, headers=headers, json=patch)
    assert response.status_code == 200, response.text
    db.refresh(task)
    expected_start = "2027-02-04T15:00:00" if cleaning_change == "rescheduled" else "2027-02-04T12:00:00"
    assert task.scheduled_start_at.isoformat() == expected_start
    assert task.id == previous_task_id
    assert db.query(TaskItem).filter_by(checkout_reservation_id=original["id"]).count() == 1
    reread = client.get(url, headers=headers)
    assert reread.status_code == 200, reread.text
    assert reread.json()["cleaning_scheduled_at"].removesuffix("Z") == expected_start
    notes_only = client.patch(url, headers=headers, json={"notes": "notes only"})
    assert notes_only.status_code == 200, notes_only.text
    db.refresh(task)
    assert task.scheduled_start_at.isoformat() == expected_start
    assert task.id == previous_task_id
