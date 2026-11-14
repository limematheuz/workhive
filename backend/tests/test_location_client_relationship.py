from app.models.task_item import TaskItem
from tests.test_client_permission_authorization import _client
from tests.test_location_workspace import _admin, _company, _headers


def test_location_client_changes_are_tenant_scoped_and_preserve_existing_work(client, db):
    company = _company(db, "RelationshipOwner")
    admin = _admin(db, company)
    first = _client(db, company, "First account")
    second = _client(db, company, "Second account")
    outsider = _client(db, _company(db, "RelationshipOther"), "Other company account")
    headers = _headers(admin)
    created = client.post("/api/v1/locations/", headers=headers, json={
        "name": "Relationship site", "address": "QA address", "city": "QA city", "client_id": first.id,
    })
    assert created.status_code == 201, created.text
    location_id = created.json()["id"]
    task = TaskItem(title="Existing work", company_id=company.id, location_id=location_id,
                    status="pending", unit="service", quantity=1, price=7.5)
    db.add(task)
    db.commit()
    task_id = task.id
    url = f"/api/v1/locations/{location_id}"
    changed = client.patch(url, headers=headers, json={"client_id": second.id})
    assert changed.status_code == 200, changed.text
    original = client.get(url, headers=headers).json()
    assert original["client_id"] == second.id
    assert client.get(f"/api/v1/locations/?client_id={first.id}", headers=headers).json() == []
    assert [row["id"] for row in client.get(f"/api/v1/locations/?client_id={second.id}", headers=headers).json()] == [location_id]
    rejected = client.patch(url, headers=headers, json={"client_id": outsider.id, "name": "Rejected name"})
    assert rejected.status_code == 404, rejected.text
    assert client.get(url, headers=headers).json() == original
    updated = client.patch(url, headers=headers, json={"name": "Renamed site"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["client_id"] == second.id
    detached = client.patch(url, headers=headers, json={"client_id": None})
    assert detached.status_code == 200, detached.text
    assert detached.json()["client_id"] is None
    assert client.get(f"/api/v1/locations/?client_id={second.id}", headers=headers).json() == []
    db.expire_all()
    existing = db.get(TaskItem, task_id)
    assert (existing.location_id, existing.status, existing.price) == (location_id, "pending", 7.5)
