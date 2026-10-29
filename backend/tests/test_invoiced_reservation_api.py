import pytest

from app.models.company import Company
from app.models.task_item import TaskItem
from tests.test_reservation_status_contract import _setup
from tests.test_reservations import _company, _headers, _user


def _invoiced_stay(client, db):
    headers, payload = _setup(db)
    created = client.post("/api/v1/reservations/", headers=headers, json={**payload, "cleaning_required": True})
    assert created.status_code == 201, created.text
    reservation_id = created.json()["id"]
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation_id).one()
    task.is_invoiced = True
    db.commit()
    return headers, f"/api/v1/reservations/{reservation_id}", task


def _task_snapshot(task):
    return (task.id, task.company_id, task.user_id, task.checkout_reservation_id,
            task.status, task.scheduled_start_at, task.due_at, task.priority,
            task.price, task.quantity, task.is_invoiced)


@pytest.mark.parametrize("operation", ["cancel", "disable_cleaning", "delete"])
@pytest.mark.parametrize("actor", ["owner", "anonymous", "other_company", "viewer"])
def test_invoiced_reservation_rejects_destructive_changes_without_mutation(client, db, operation, actor):
    owner_headers, url, task = _invoiced_stay(client, db)
    original = client.get(url, headers=owner_headers).json()
    before_task = _task_snapshot(task)
    headers = owner_headers
    expected = 409
    if actor == "anonymous":
        headers, expected = {}, 401
    elif actor == "other_company":
        company = _company(db, "QA other invoice", "QAOTHERINVOICE")
        company.subscription_status = "active"
        outsider = _user(db, company, 1, "qa-other-invoice@example.test")
        headers, expected = _headers(outsider), 403
    elif actor == "viewer":
        viewer = _user(db, db.get(Company, task.company_id), 3, "qa-viewer-invoice@example.test")
        headers, expected = _headers(viewer), 403
    if operation == "delete":
        rejected = client.delete(url, headers=headers)
    else:
        payload = {"status": "cancelled"} if operation == "cancel" else {"cleaning_required": False}
        rejected = client.patch(url, headers=headers, json={**payload, "notes": "must not persist"})
    assert rejected.status_code == expected, rejected.text
    if actor == "other_company":
        assert rejected.json()["detail"] == "Only the company that owns the reservation can modify it"
    assert client.get(url, headers=owner_headers).json() == original
    db.refresh(task)
    assert _task_snapshot(task) == before_task
    assert db.query(TaskItem).filter_by(checkout_reservation_id=original["id"]).count() == 1


def test_invoiced_reservation_allows_notes_without_rewriting_invoiced_work(client, db):
    headers, url, task = _invoiced_stay(client, db)
    before_task = _task_snapshot(task)
    response = client.patch(url, headers=headers, json={"notes": "QA invoice history note"})
    assert response.status_code == 200, response.text
    assert response.json()["notes"] == "QA invoice history note"
    assert response.json()["status"] == "confirmed"
    db.refresh(task)
    assert _task_snapshot(task) == before_task
