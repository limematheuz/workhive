from decimal import Decimal

from app.models.client import Client
from app.models.location import Location
from tests.test_location_workspace import _admin, _company, _headers


def _inventory_company(db, name: str):
    company = _company(db, name)
    company.subscription_plan = "top"
    db.commit()
    return company


def _work_order(client, db, headers, company, *, client_id: int | None = None):
    location = Location(
        name="Centro de consumo",
        address="Calle Operación 1",
        city="Madrid",
        owner_company_id=company.id,
        client_id=client_id,
    )
    db.add(location)
    db.commit()
    response = client.post(
        "/api/v1/work-orders/",
        headers=headers,
        json={
            "title": "Limpieza de turno",
            "location_id": location.id,
            "status": "active",
            "scheduled_start_at": "2026-10-02T09:00:00Z",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _client(db, company):
    client = Client(
        company_id=company.id,
        name="Cliente del centro",
        address="Calle Cliente 1",
        city="Madrid",
        postal_code="28001",
        country="España",
    )
    db.add(client)
    db.commit()
    return client


def _lot_receipt(client, headers):
    supplier = client.post(
        "/api/v1/inventory/suppliers",
        headers=headers,
        json={"name": "Química de lotes"},
    ).json()
    material = client.post(
        "/api/v1/inventory/materials",
        headers=headers,
        json={"sku": "LOT-001", "name": "Desinfectante", "unit": "liter"},
    ).json()
    warehouse = client.post(
        "/api/v1/inventory/warehouses",
        headers=headers,
        json={"name": "Almacén operativo"},
    ).json()
    purchase = client.post(
        "/api/v1/inventory/purchases/",
        headers=headers,
        json={
            "supplier_id": supplier["id"],
            "expense_date": "2026-10-01T12:00:00Z",
            "category": "supplies",
            "description": "Recepción con lote",
            "tax_amount": "0",
            "lines": [
                {
                    "material_id": material["id"],
                    "warehouse_id": warehouse["id"],
                    "quantity": "10.000",
                    "unit_cost": "2.5000",
                    "lot_code": "L-2026-10",
                    "lot_expires_at": "2027-10-01",
                }
            ],
        },
    )
    assert purchase.status_code == 201, purchase.text
    return material, warehouse, purchase.json()


def test_work_order_consumption_uses_a_lot_and_reverses_immutably(client, db):
    company = _inventory_company(db, "LotConsumptionOwner")
    headers = _headers(_admin(db, company))
    customer = _client(db, company)
    work_order = _work_order(client, db, headers, company, client_id=customer.id)
    material, warehouse, purchase = _lot_receipt(client, headers)
    lot_id = purchase["lines"][0]["lot_id"]

    lots = client.get("/api/v1/inventory/lots", headers=headers)
    assert lots.status_code == 200, lots.text
    assert lots.json()[0]["code"] == "L-2026-10"
    assert Decimal(lots.json()[0]["available_quantity"]) == Decimal("10.000")

    consumed = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials",
        headers=headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "lot_id": lot_id,
            "quantity": "3.000",
            "notes": "Reposición de turno",
        },
    )
    assert consumed.status_code == 201, consumed.text
    issue = consumed.json()
    assert issue["movement_type"] == "issue"
    assert issue["work_order_id"] == work_order["id"]
    assert issue["lot_id"] == lot_id
    assert issue["client_id"] == customer.id
    assert Decimal(issue["unit_cost"]) == Decimal("2.5000")

    lots_after_issue = client.get("/api/v1/inventory/lots", headers=headers).json()
    assert Decimal(lots_after_issue[0]["available_quantity"]) == Decimal("7.000")

    corrected = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials/{issue['id']}/reverse",
        headers=headers,
        json={"reason": "Cantidad anotada por error"},
    )
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["movement_type"] == "adjustment_in"
    assert corrected.json()["reversal_of_movement_id"] == issue["id"]
    assert corrected.json()["client_id"] == customer.id
    assert Decimal(corrected.json()["unit_cost"]) == Decimal("2.5000")
    assert Decimal(
        client.get("/api/v1/inventory/lots", headers=headers).json()[0][
            "available_quantity"
        ]
    ) == Decimal("10.000")

    repeated = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials/{issue['id']}/reverse",
        headers=headers,
        json={"reason": "No debe duplicarse"},
    )
    assert repeated.status_code == 409


def test_work_order_consumption_rejects_foreign_or_unavailable_lots(client, db):
    owner = _inventory_company(db, "LotConsumptionOwner2")
    other = _inventory_company(db, "LotConsumptionOther")
    owner_headers = _headers(_admin(db, owner))
    other_headers = _headers(_admin(db, other))
    work_order = _work_order(client, db, owner_headers, owner)
    material, warehouse, purchase = _lot_receipt(client, owner_headers)
    lot_id = purchase["lines"][0]["lot_id"]

    lot_required = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "quantity": "1.000",
        },
    )
    assert lot_required.status_code == 422
    assert lot_required.headers["x-workhive-error-code"] == "inventory.lot_required"

    manual_lot_required = client.post(
        "/api/v1/inventory/movements",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "movement_type": "issue",
            "quantity": "1.000",
        },
    )
    assert manual_lot_required.status_code == 422
    assert (
        manual_lot_required.headers["x-workhive-error-code"] == "inventory.lot_required"
    )

    unavailable = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials",
        headers=owner_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "lot_id": lot_id,
            "quantity": "11.000",
        },
    )
    assert unavailable.status_code == 409
    assert (
        unavailable.headers["x-workhive-error-code"] == "inventory.insufficient_stock"
    )

    foreign = client.post(
        f"/api/v1/work-orders/{work_order['id']}/materials",
        headers=other_headers,
        json={
            "material_id": material["id"],
            "warehouse_id": warehouse["id"],
            "lot_id": lot_id,
            "quantity": "1.000",
        },
    )
    assert foreign.status_code == 404


def test_work_order_consumption_snapshots_the_available_weighted_cost(client, db):
    company = _inventory_company(db, "WeightedConsumptionOwner")
    headers = _headers(_admin(db, company))
    customer = _client(db, company)
    work_order = _work_order(
        client, db, headers, company, client_id=customer.id
    )
    supplier = client.post(
        "/api/v1/inventory/suppliers", headers=headers, json={"name": "Proveedor medio"}
    ).json()
    material = client.post(
        "/api/v1/inventory/materials",
        headers=headers,
        json={"sku": "AVG-001", "name": "Consumible medio", "unit": "unit"},
    ).json()
    warehouse = client.post(
        "/api/v1/inventory/warehouses",
        headers=headers,
        json={"name": "Almacén medio"},
    ).json()

    def receive(quantity: str, unit_cost: str):
        response = client.post(
            "/api/v1/inventory/purchases/",
            headers=headers,
            json={
                "supplier_id": supplier["id"],
                "expense_date": "2026-10-01T12:00:00Z",
                "category": "supplies",
                "description": "Recepción para coste medio",
                "tax_amount": "0",
                "lines": [
                    {
                        "material_id": material["id"],
                        "warehouse_id": warehouse["id"],
                        "quantity": quantity,
                        "unit_cost": unit_cost,
                    }
                ],
            },
        )
        assert response.status_code == 201, response.text

    def consume(quantity: str):
        response = client.post(
            f"/api/v1/work-orders/{work_order['id']}/materials",
            headers=headers,
            json={
                "material_id": material["id"],
                "warehouse_id": warehouse["id"],
                "quantity": quantity,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    receive("10.000", "2.0000")
    assert Decimal(consume("4.000")["unit_cost"]) == Decimal("2.0000")
    receive("6.000", "4.0000")

    # The remaining 6 × €2 plus 6 × €4 make 12 units valued at €36.
    assert Decimal(consume("2.000")["unit_cost"]) == Decimal("3.0000")
