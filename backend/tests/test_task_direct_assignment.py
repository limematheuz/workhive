import pytest

from app.models.task_item import TaskItem
from tests.test_task_security_delivery import _company, _headers, _location, _user


@pytest.fixture
def assignment_setup(db, monkeypatch):
    monkeypatch.setattr("app.api.v1.task_items.sync_company_calendar", lambda *args, **kwargs: None)
    company = _company(db, "DirectAssignment")
    foreign = _company(db, "ForeignAssignment")
    admin = _user(db, company, "admin@direct-assignment.test", 1)
    first = _user(db, company, "first@direct-assignment.test", 3)
    second = _user(db, company, "second@direct-assignment.test", 3)
    inactive = _user(db, company, "inactive@direct-assignment.test", 3)
    inactive.is_active = False
    outsider = _user(db, foreign, "worker@foreign-assignment.test", 3)
    db.commit()
    return admin, first, second, _location(db, company), {
        "inactive": inactive.id, "foreign": outsider.id, "unknown": 999_999,
    }


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("assignee", ["inactive", "foreign", "unknown"])
def test_invalid_direct_assignee_is_rejected_without_changes(client, db, assignment_setup, operation, assignee):
    admin, first, _, location, invalid = assignment_setup
    created = client.post("/api/v1/task-items/", headers=_headers(admin), json={
        "title": "Original assignment", "unit": "servicio", "location_id": location.id,
        "user_id": first.id, "description": "- [ ] Pending requirement",
    })
    assert created.status_code == 201, created.text
    before = created.json()
    count = db.query(TaskItem).count()
    if operation == "create":
        response = client.post("/api/v1/task-items/", headers=_headers(admin), json={
            "title": "Invalid assignment", "unit": "servicio", "location_id": location.id,
            "user_id": invalid[assignee],
        })
    else:
        response = client.patch(f"/api/v1/task-items/{before['id']}", headers=_headers(admin), json={
            "user_id": invalid[assignee], "title": "Must not be saved", "priority": "high",
        })

    assert response.status_code == 400, response.text
    assert db.query(TaskItem).count() == count
    after = client.get(f"/api/v1/task-items/{before['id']}", headers=_headers(admin))
    assert after.status_code == 200, after.text
    assert after.json() == before


def test_direct_reassignment_and_removal_update_worker_access(client, assignment_setup):
    admin, first, second, location, _ = assignment_setup
    created = client.post("/api/v1/task-items/", headers=_headers(admin), json={
        "title": "Reassignment", "unit": "servicio", "location_id": location.id,
        "user_id": first.id, "description": "- [ ] Pending requirement",
    })
    assert created.status_code == 201, created.text
    task = created.json()
    task_id = task["id"]
    checklist = task["checklist_items"]
    assert client.get(f"/api/v1/task-items/{task_id}", headers=_headers(first)).status_code == 200
    assert client.get(f"/api/v1/task-items/{task_id}", headers=_headers(second)).status_code == 404

    for assignee in (second.id, None):
        response = client.patch(f"/api/v1/task-items/{task_id}", headers=_headers(admin), json={"user_id": assignee})
        assert response.status_code == 200, response.text
        updated = response.json()
        assert updated["user_id"] == assignee
        assert updated["checklist_items"] == checklist
        assert [item["user_id"] for item in updated["assignments"]] == ([] if assignee is None else [assignee])
        for worker in (first, second):
            expected = 200 if worker.id == assignee else 404
            assert client.get(f"/api/v1/task-items/{task_id}", headers=_headers(worker)).status_code == expected
            listing = client.get("/api/v1/task-items/", headers=_headers(worker))
            assert listing.status_code == 200, listing.text
            assert (task_id in [item["id"] for item in listing.json()]) == (expected == 200)


@pytest.mark.parametrize("assigned", [True, False])
def test_workers_cannot_reassign_tasks(client, assignment_setup, assigned):
    admin, first, second, location, _ = assignment_setup
    created = client.post("/api/v1/task-items/", headers=_headers(admin), json={
        "title": "Administrative assignment", "unit": "servicio", "location_id": location.id,
        "user_id": first.id,
    })
    assert created.status_code == 201, created.text
    before = created.json()
    response = client.patch(
        f"/api/v1/task-items/{before['id']}", headers=_headers(first if assigned else second),
        json={"user_id": second.id},
    )

    assert response.status_code == 403, response.text
    after = client.get(f"/api/v1/task-items/{before['id']}", headers=_headers(admin))
    assert after.status_code == 200, after.text
    assert after.json() == before
