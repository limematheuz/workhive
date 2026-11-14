from app.models.task_item import TaskItem
import pytest

from tests.test_client_permission_authorization import _assign_company_profile, _client
from tests.test_location_workspace import _admin, _company, _headers
from tests.test_organization_api import _user


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


@pytest.mark.parametrize("scope", ["managed", "read_only", "other_location"])
def test_linked_location_editing_respects_scope_without_client_read_access(client, db, scope):
    company = _company(db, f"LinkedScope{scope}")
    admin = _admin(db, company)
    account = _client(db, company, "Linked account")
    admin_headers = _headers(admin)
    created = client.post("/api/v1/locations/", headers=admin_headers, json={
        "name": "Linked site", "address": "QA address", "city": "QA city", "client_id": account.id,
    })
    assert created.status_code == 201, created.text
    location_id = created.json()["id"]
    other = client.post("/api/v1/locations/", headers=admin_headers, json={
        "name": "Other site", "address": "QA address", "city": "QA city",
    })
    assert other.status_code == 201, other.text
    member = _user(db, company, f"linked-{scope}", 2)
    _assign_company_profile(
        db, company=company, admin=admin, user=member, name="Location reader",
        permission_codes={"locations.read"},
    )
    if scope != "read_only":
        _assign_company_profile(
            db, company=company, admin=admin, user=member, name="Scoped location manager",
            permission_codes={"locations.manage"}, scope_type="location",
            scope_id=location_id if scope == "managed" else other.json()["id"],
        )
    headers = _headers(member)
    access = client.get("/api/v1/clients/access", headers=headers)
    assert access.status_code == 200, access.text
    assert access.json()["can_read_clients"] is False
    assert client.get(f"/api/v1/clients/{account.id}", headers=headers).status_code == 403
    url = f"/api/v1/locations/{location_id}"
    before = client.get(url, headers=admin_headers).json()
    payload = {"name": "Updated site"} if scope == "managed" else {"name": "Denied change", "client_id": None}
    response = client.patch(url, headers=headers, json=payload)
    if scope == "managed":
        assert response.status_code == 200, response.text
        saved = client.get(url, headers=admin_headers).json()
        assert saved["name"] == "Updated site"
        assert saved["client_id"] == account.id
    else:
        assert response.status_code == 403, response.text
        assert client.get(url, headers=admin_headers).json() == before
