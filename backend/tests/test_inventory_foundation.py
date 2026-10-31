from decimal import Decimal

from app.models.user import User
from tests.test_location_workspace import _admin, _company, _headers


def _inventory_company(db, name: str):
    company = _company(db, name)
    company.subscription_plan = "top"
    db.commit()
    return company


def test_inventory_catalogue_and_immutable_stock_ledger_are_tenant_scoped(client, db):
    owner_company = _inventory_company(db, "InventoryOwner")
    other_company = _inventory_company(db, "InventoryOther")
    owner_headers = _headers(_admin(db, owner_company))
    other_headers = _headers(_admin(db, other_company))

    supplier_response = client.post(
        "/api/v1/inventory/suppliers",
        headers=owner_headers,
        json={
            "name": "Química E2E",
            "tax_id": "B12345678",
            "contact_name": "Ana Proveedora",
            "email": "ventas@quimica.example",
        },
    )
    assert supplier_response.status_code == 201, supplier_response.text
    supplier = supplier_response.json()
    assert supplier["name"] == "Química E2E"

    material_response = client.post(
        "/api/v1/inventory/materials",
        headers=owner_headers,
        json={
            "sku": "CHEM-001",
            "name": "Desinfectante concentrado",
            "unit": "liter",
            "supplier_id": supplier["id"],
            "reorder_point": "3.000",
        },
    )
    assert material_response.status_code == 201, material_response.text
    material = material_response.json()
    assert material["sku"] == "CHEM-001"
    assert material["unit"] == "liter"

    warehouse_response = client.post(
        "/api/v1/inventory/warehouses",
        headers=owner_headers,
        json={"name": "Almacén central", "address": "Calle Stock 1"},
    )
    assert warehouse_response.status_code == 201, warehouse_response.text
    warehouse = warehouse_response.json()

    receipt = client.post(
        "/api/v1/inventory/movements",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "receipt",
            "quantity": "12.000",
            "unit_cost": "2.40",
            "reference": "ALB-001",
        },
    )
    assert receipt.status_code == 201, receipt.text
    assert receipt.json()["movement_type"] == "receipt"

    issued = client.post(
        "/api/v1/inventory/movements",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "issue",
            "quantity": "4.000",
            "reference": "Salida de prueba",
        },
    )
    assert issued.status_code == 201, issued.text

    balances = client.get("/api/v1/inventory/stock", headers=owner_headers)
    assert balances.status_code == 200, balances.text
    assert balances.json() == [
        {
            "material_id": material["id"],
            "material_sku": "CHEM-001",
            "material_name": "Desinfectante concentrado",
            "unit": "liter",
            "warehouse_id": warehouse["id"],
            "warehouse_name": "Almacén central",
            "available_quantity": "8.000",
            "reorder_point": "3.000",
            "is_below_reorder_point": False,
        }
    ]

    ledger_before_rejection = client.get(
        "/api/v1/inventory/movements", headers=owner_headers
    ).json()
    assert len(ledger_before_rejection) == 2
    insufficient = client.post(
        "/api/v1/inventory/movements",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "issue",
            "quantity": "9.000",
        },
    )
    assert insufficient.status_code == 409
    assert (
        insufficient.headers["x-workhive-error-code"] == "inventory.insufficient_stock"
    )

    assert client.get(
        "/api/v1/inventory/movements", headers=owner_headers
    ).json() == ledger_before_rejection
    assert client.get(
        "/api/v1/inventory/stock", headers=owner_headers
    ).json() == balances.json()

    assert client.get("/api/v1/inventory/materials", headers=other_headers).json() == []
    cross_tenant = client.post(
        "/api/v1/inventory/movements",
        headers=other_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "receipt",
            "quantity": "1.000",
        },
    )
    assert cross_tenant.status_code == 404
    assert client.get(
        "/api/v1/inventory/movements", headers=owner_headers
    ).json() == ledger_before_rejection
    assert client.get(
        "/api/v1/inventory/stock", headers=owner_headers
    ).json() == balances.json()

    assert Decimal(balances.json()[0]["available_quantity"]) == Decimal("8.000")


def test_inventory_rejects_companies_without_the_feature(client, db):
    basic_company = _company(db, "InventoryBasic")
    basic_company.subscription_plan = "basic"
    db.commit()
    headers = _headers(_admin(db, basic_company))

    response = client.get("/api/v1/inventory/materials", headers=headers)

    assert response.status_code == 403
    assert (
        response.headers["x-workhive-error-code"] == "entitlement.feature_not_in_plan"
    )


def test_inventory_allows_managers_but_denies_viewers(client, db):
    company = _inventory_company(db, "InventoryRoles")
    manager = User(
        email="inventory-manager@roles.test",
        hashed_password="unused",
        full_name="Inventory Manager",
        company_id=company.id,
        role_id=2,
        is_active=True,
    )
    viewer = User(
        email="inventory-viewer@roles.test",
        hashed_password="unused",
        full_name="Inventory Viewer",
        company_id=company.id,
        role_id=3,
        is_active=True,
    )
    db.add_all([manager, viewer])
    db.commit()
    db.refresh(manager)
    db.refresh(viewer)

    manager_headers = _headers(manager)
    viewer_headers = _headers(viewer)
    created = client.post(
        "/api/v1/inventory/suppliers",
        headers=manager_headers,
        json={"name": "Proveedor gestionado"},
    )

    assert created.status_code == 201, created.text
    assert client.get("/api/v1/inventory/suppliers", headers=viewer_headers).status_code == 403
    assert (
        client.post(
            "/api/v1/inventory/suppliers",
            headers=viewer_headers,
            json={"name": "Proveedor no autorizado"},
        ).status_code
        == 403
    )


def test_inventory_archives_empty_catalogue_entities_without_erasing_ledger(client, db):
    company = _inventory_company(db, "InventoryArchive")
    headers = _headers(_admin(db, company))

    supplier = client.post(
        "/api/v1/inventory/suppliers",
        headers=headers,
        json={"name": "Proveedor archivado"},
    ).json()
    material = client.post(
        "/api/v1/inventory/materials",
        headers=headers,
        json={"sku": "ARCH-001", "name": "Material archivable", "supplier_id": supplier["id"]},
    ).json()
    warehouse = client.post(
        "/api/v1/inventory/warehouses",
        headers=headers,
        json={"name": "Almacén archivable"},
    ).json()

    receipt = client.post(
        "/api/v1/inventory/movements",
        headers=headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "receipt",
            "quantity": "1.000",
        },
    )
    assert receipt.status_code == 201, receipt.text
    assert client.delete(
        f"/api/v1/inventory/materials/{material['id']}", headers=headers
    ).status_code == 409
    assert client.delete(
        f"/api/v1/inventory/warehouses/{warehouse['id']}", headers=headers
    ).status_code == 409

    drained = client.post(
        "/api/v1/inventory/movements",
        headers=headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "adjustment_out",
            "quantity": "1.000",
            "reference": "Corrección de catálogo QA",
        },
    )
    assert drained.status_code == 201, drained.text

    assert client.delete(
        f"/api/v1/inventory/materials/{material['id']}", headers=headers
    ).status_code == 204
    assert client.delete(
        f"/api/v1/inventory/warehouses/{warehouse['id']}", headers=headers
    ).status_code == 204
    assert client.delete(
        f"/api/v1/inventory/suppliers/{supplier['id']}", headers=headers
    ).status_code == 204

    assert client.get("/api/v1/inventory/materials", headers=headers).json() == []
    assert client.get("/api/v1/inventory/warehouses", headers=headers).json() == []
    assert client.get("/api/v1/inventory/suppliers", headers=headers).json() == []
    assert client.get("/api/v1/inventory/lots", headers=headers).json() == []
    movements = client.get("/api/v1/inventory/movements", headers=headers).json()
    assert [movement["id"] for movement in movements] == [drained.json()["id"], receipt.json()["id"]]
    assert {
        (movement["material_name"], movement["warehouse_name"])
        for movement in movements
    } == {("Material archivable", "Almacén archivable")}
