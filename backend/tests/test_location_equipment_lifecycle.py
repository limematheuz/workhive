import pytest

from app.models.inventory import (
    InventoryMaterial,
    InventoryMovement,
    InventoryWarehouse,
)
from app.models.location_equipment import LocationEquipment
from app.models.task_item import TaskItem
from tests.test_location_assets import _location, _viewer
from tests.test_location_workspace import _admin, _company, _headers


@pytest.mark.parametrize(
    "actor", ["assigned_worker", "unassigned_worker", "other_company", "anonymous"]
)
@pytest.mark.parametrize("method", ["post", "patch", "delete"])
def test_equipment_mutations_require_management_and_preserve_records(
    client, db, actor, method
):
    company = _company(db, "EquipmentPermissions")
    admin = _admin(db, company)
    location = _location(db, company)
    worker = _viewer(db, company)
    if actor == "assigned_worker":
        db.add(
            TaskItem(
                title="Assigned equipment visit",
                unit="service",
                company_id=company.id,
                location_id=location.id,
                user_id=worker.id,
                status="accepted",
            )
        )
        db.commit()
    headers = _headers(worker)
    if actor == "other_company":
        headers = _headers(_admin(db, _company(db, "EquipmentOutsider")))
    elif actor == "anonymous":
        headers = {}
    base = f"/api/v1/locations/{location.id}/equipment"
    created = client.post(
        base, headers=_headers(admin), json={"name": "Protected asset"}
    )
    assert created.status_code == 201, created.text
    original = created.json()
    url = base if method == "post" else f"{base}/{original['id']}"
    kwargs = {"headers": headers}
    if method != "delete":
        kwargs["json"] = {"name": "Unauthorized change", "status": "retired"}
    response = getattr(client, method)(url, **kwargs)
    expected = 401 if actor == "anonymous" else 404 if actor == "other_company" else 403
    assert response.status_code == expected, response.text
    assert client.get(base, headers=_headers(admin)).json() == [original]
    visible = client.get("/api/v1/location-equipment", headers=headers)
    if actor == "anonymous":
        assert visible.status_code == 401
    else:
        assert visible.status_code == 200
        expected_ids = [original["id"]] if actor == "assigned_worker" else []
        assert [item["id"] for item in visible.json()] == expected_ids


@pytest.mark.parametrize("role_id", [1, 2])
def test_equipment_lifecycle_stays_at_its_location_and_does_not_create_stock(
    client, db, role_id
):
    company = _company(db, "EquipmentLifecycle")
    admin = _admin(db, company)
    admin.role_id = role_id
    db.commit()
    location = _location(db, company)
    other_location = _location(db, company, "Separate site")
    headers = _headers(admin)
    base = f"/api/v1/locations/{location.id}/equipment"
    stock_models = (InventoryMaterial, InventoryWarehouse, InventoryMovement)
    stock_before = {model: db.query(model).count() for model in stock_models}
    created = client.post(
        base, headers=headers, json={"name": "Floor cleaner", "quantity": 2}
    )
    assert created.status_code == 201, created.text
    equipment_id = created.json()["id"]
    url = f"{base}/{equipment_id}"
    for state in ("maintenance", "retired", "active"):
        updated = client.patch(
            url,
            headers=headers,
            json={
                "status": state,
                "serial_number": "EQ-42",
                "next_service_at": "2027-01-15",
                "notes": "Service history",
            },
        )
        assert updated.status_code == 200, updated.text
        equipment = updated.json()
        assert equipment["status"] == state
        assert equipment["quantity"] == 2
        assert equipment["next_service_at"] == "2027-01-15"
        assert client.get(base, headers=headers).json() == [equipment]
        library = client.get("/api/v1/location-equipment", headers=headers).json()
        assert library == [
            {**equipment, "location_id": location.id, "location_name": location.name}
        ]
    for method in ("patch", "delete"):
        wrong_url = f"/api/v1/locations/{other_location.id}/equipment/{equipment_id}"
        kwargs = {"headers": headers}
        if method == "patch":
            kwargs["json"] = {"name": "Wrong location"}
        assert getattr(client, method)(wrong_url, **kwargs).status_code == 404
        assert client.get(base, headers=headers).json() == [equipment]
    for invalid in (
        {"quantity": 0},
        {"quantity": 10001},
        {"status": "unknown"},
        {"name": "  "},
    ):
        assert client.patch(url, headers=headers, json=invalid).status_code == 422
        assert client.get(base, headers=headers).json() == [equipment]
    assert client.delete(url, headers=headers).status_code == 204
    assert client.delete(url, headers=headers).status_code == 404
    assert (
        client.patch(url, headers=headers, json={"status": "active"}).status_code == 404
    )
    assert client.get(base, headers=headers).json() == []
    assert client.get("/api/v1/location-equipment", headers=headers).json() == []
    db.expire_all()
    archived = db.get(LocationEquipment, equipment_id)
    assert archived.is_active is False
    assert archived.location_id == location.id
    assert archived.serial_number == "EQ-42"
    assert {model: db.query(model).count() for model in stock_models} == stock_before
