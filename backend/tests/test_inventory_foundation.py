from decimal import Decimal

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
