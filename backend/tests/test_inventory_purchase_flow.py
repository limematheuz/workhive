from decimal import Decimal

from tests.test_location_workspace import _admin, _company, _headers


def _inventory_company(db, name: str):
    company = _company(db, name)
    company.subscription_plan = "top"
    db.commit()
    return company


def _catalogue(client, headers):
    supplier = client.post(
        "/api/v1/inventory/suppliers",
        headers=headers,
        json={"name": "Suministros Delta", "tax_id": "B12345678"},
    )
    assert supplier.status_code == 201, supplier.text
    material = client.post(
        "/api/v1/inventory/materials",
        headers=headers,
        json={
            "sku": "DELTA-01",
            "name": "Bobina industrial",
            "supplier_id": supplier.json()["id"],
        },
    )
    assert material.status_code == 201, material.text
    warehouse = client.post(
        "/api/v1/inventory/warehouses",
        headers=headers,
        json={"name": "Almacén compras"},
    )
    assert warehouse.status_code == 201, warehouse.text
    return supplier.json(), material.json(), warehouse.json()


def _purchase_payload(supplier_id: int, material_id: int, warehouse_id: int):
    return {
        "supplier_id": supplier_id,
        "expense_date": "2026-09-12T12:00:00Z",
        "category": "supplies",
        "description": "Compra de bobinas para operación",
        "payment_method": "bank_transfer",
        "tax_amount": "2.63",
        "receipt_url": "/api/v1/uploads/receipts/delta.pdf",
        "reference": "ALB-DELTA-42",
        "notes": "Recepción completa",
        "lines": [
            {
                "material_id": material_id,
                "warehouse_id": warehouse_id,
                "quantity": "5.000",
                "unit_cost": "2.5000",
            }
        ],
    }


def test_purchase_creates_one_expense_and_immutable_receipt_then_reverses(client, db):
    company = _inventory_company(db, "PurchaseOwner")
    headers = _headers(_admin(db, company))
    supplier, material, warehouse = _catalogue(client, headers)

    created = client.post(
        "/api/v1/inventory/purchases/",
        headers=headers,
        json=_purchase_payload(supplier["id"], material["id"], warehouse["id"]),
    )
    assert created.status_code == 201, created.text
    purchase = created.json()
    assert purchase["status"] == "received"
    assert purchase["supplier_name_snapshot"] == "Suministros Delta"
    assert purchase["supplier_tax_id_snapshot"] == "B12345678"
    assert purchase["expense"]["vendor"] == "Suministros Delta"
    assert purchase["expense"]["base_amount"] == 12.5
    assert purchase["expense"]["tax_amount"] == 2.63
    assert purchase["expense"]["total_amount"] == 15.13
    assert purchase["lines"][0]["quantity"] == "5.000"
    assert purchase["lines"][0]["unit_cost"] == "2.5000"

    expenses = client.get("/api/v1/expenses/", headers=headers)
    assert expenses.status_code == 200, expenses.text
    assert [expense["id"] for expense in expenses.json()] == [purchase["expense_id"]]

    stock = client.get("/api/v1/inventory/stock", headers=headers)
    assert stock.status_code == 200, stock.text
    assert Decimal(stock.json()[0]["available_quantity"]) == Decimal("5.000")

    purchases = client.get("/api/v1/inventory/purchases/", headers=headers)
    assert purchases.status_code == 200, purchases.text
    assert [item["id"] for item in purchases.json()] == [purchase["id"]]

    blocked_update = client.patch(
        f"/api/v1/expenses/{purchase['expense_id']}",
        headers=headers,
        json={"description": "No debe editarse fuera de la compra"},
    )
    assert blocked_update.status_code == 409
    assert (
        blocked_update.headers["x-workhive-error-code"]
        == "inventory.purchase_managed_expense"
    )
    blocked_delete = client.delete(
        f"/api/v1/expenses/{purchase['expense_id']}", headers=headers
    )
    assert blocked_delete.status_code == 409

    reversed_response = client.post(
        f"/api/v1/inventory/purchases/{purchase['id']}/reverse",
        headers=headers,
        json={"reason": "Devolución total al proveedor"},
    )
    assert reversed_response.status_code == 200, reversed_response.text
    reversed_purchase = reversed_response.json()
    assert reversed_purchase["status"] == "reversed"
    assert reversed_purchase["reversal_reason"] == "Devolución total al proveedor"
    assert reversed_purchase["expense"]["is_active"] is False

    assert client.get("/api/v1/expenses/", headers=headers).json() == []
    movements = client.get("/api/v1/inventory/movements", headers=headers)
    assert [item["movement_type"] for item in movements.json()] == [
        "adjustment_out",
        "receipt",
    ]
    stock_after_reversal = client.get("/api/v1/inventory/stock", headers=headers)
    assert Decimal(stock_after_reversal.json()[0]["available_quantity"]) == Decimal(
        "0.000"
    )


def test_purchase_reversal_fails_without_enough_stock_and_keeps_expense(client, db):
    company = _inventory_company(db, "PurchaseConsumed")
    headers = _headers(_admin(db, company))
    supplier, material, warehouse = _catalogue(client, headers)
    created = client.post(
        "/api/v1/inventory/purchases/",
        headers=headers,
        json=_purchase_payload(supplier["id"], material["id"], warehouse["id"]),
    )
    assert created.status_code == 201, created.text
    purchase = created.json()

    consumed = client.post(
        "/api/v1/inventory/movements",
        headers=headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "issue",
            "quantity": "1.000",
            "reference": "Consumo en orden",
        },
    )
    assert consumed.status_code == 201, consumed.text

    rejected = client.post(
        f"/api/v1/inventory/purchases/{purchase['id']}/reverse",
        headers=headers,
        json={"reason": "No debe crear una devolución parcial"},
    )
    assert rejected.status_code == 409
    assert rejected.headers["x-workhive-error-code"] == "inventory.insufficient_stock"
    assert client.get(f"/api/v1/expenses/{purchase['expense_id']}", headers=headers).status_code == 200
    assert Decimal(client.get("/api/v1/inventory/stock", headers=headers).json()[0]["available_quantity"]) == Decimal(
        "4.000"
    )


def test_purchase_hides_foreign_supplier_and_material(client, db):
    owner = _inventory_company(db, "PurchaseTenantOwner")
    other = _inventory_company(db, "PurchaseTenantOther")
    owner_headers = _headers(_admin(db, owner))
    other_headers = _headers(_admin(db, other))
    supplier, material, warehouse = _catalogue(client, owner_headers)

    rejected = client.post(
        "/api/v1/inventory/purchases/",
        headers=other_headers,
        json=_purchase_payload(supplier["id"], material["id"], warehouse["id"]),
    )
    assert rejected.status_code == 404
    assert client.get("/api/v1/inventory/purchases/", headers=other_headers).json() == []
