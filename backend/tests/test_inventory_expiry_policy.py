"""Expired lots cannot be consumed; traceable corrections remain available."""
from datetime import date, timedelta

import pytest

from tests.test_inventory_purchase_integrity import _setup, _snapshot
from tests.test_inventory_work_order_consumption import _work_order


@pytest.mark.parametrize("operation", ["issue", "order"])
def test_expired_lot_cannot_be_consumed_without_changing_history(client, db, operation):
    headers, payload = _setup(client, db, f"Expiry-{operation}")
    line = payload["lines"][0]
    line.update(lot_code="EXPIRED", lot_expires_at="2000-01-01")
    received = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert received.status_code == 201, received.text
    lot_id = received.json()["lines"][0]["lot_id"]
    path = "/api/v1/inventory/movements"
    movement = {"material_id": line["material_id"], "warehouse_id": line["warehouse_id"], "lot_id": lot_id, "quantity": "1", "movement_type": "issue"}
    if operation == "order":
        from app.models.company import Company
        company = db.query(Company).filter(Company.name == f"Expiry-{operation}").one()
        order = _work_order(client, db, headers, company)
        path = f"/api/v1/work-orders/{order['id']}/materials"
        movement.pop("movement_type")
    before = _snapshot(client, headers)
    rejected = client.post(path, headers=headers, json=movement)
    assert rejected.status_code == 409, rejected.text
    assert rejected.headers["X-WorkHive-Error-Code"] == "inventory.lot_expired"
    assert _snapshot(client, headers) == before


@pytest.mark.parametrize("kind", ["receipt", "adjustment_in", "adjustment_out"])
def test_expired_lot_adjustments_need_reason_but_purchase_returns_remain_possible(client, db, kind):
    headers, payload = _setup(client, db, f"ExpiryCorrection-{kind}")
    line = payload["lines"][0]
    line.update(lot_code="EXPIRED", lot_expires_at="2000-01-01")
    purchase = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload).json()
    movement = {"material_id": line["material_id"], "warehouse_id": line["warehouse_id"], "lot_id": purchase["lines"][0]["lot_id"], "quantity": "1", "movement_type": kind}
    before = _snapshot(client, headers)
    denied = client.post("/api/v1/inventory/movements", headers=headers, json=movement)
    assert denied.status_code == 422, denied.text
    assert _snapshot(client, headers) == before
    allowed = client.post("/api/v1/inventory/movements", headers=headers, json={**movement, "notes": "Retirada o devolución de lote vencido QA"})
    assert allowed.status_code == 201, allowed.text
    # Purchase return is also available on an expired lot when its full stock exists.
    if kind != "adjustment_out":
        returned = client.post(f"/api/v1/inventory/purchases/{purchase['id']}/reverse", headers=headers, json={"reason": "Devolución por caducidad"})
        assert returned.status_code == 200, returned.text


def test_expiry_day_and_warning_boundaries():
    from app.services.inventory_expiry_policy import expiry_status, require_usable_lot
    from types import SimpleNamespace
    today = date(2026, 10, 31)
    for offset, expected in [(-1, "expired"), (0, "expiring"), (30, "expiring"), (31, "valid")]:
        expiry = today + timedelta(days=offset)
        assert expiry_status(expiry, today=today) == expected
        if offset >= 0:
            require_usable_lot(SimpleNamespace(expires_at=expiry), today=today)
    assert expiry_status(None, today=today) == "undated"


def test_consumption_correction_remains_available_after_lot_expires(client, db):
    from app.models.company import Company
    from app.models.inventory_lot import InventoryLot
    headers, payload = _setup(client, db, "ExpiryAfterConsumption")
    company = db.query(Company).filter(Company.name == "ExpiryAfterConsumption").one()
    order = _work_order(client, db, headers, company)
    line = payload["lines"][0]
    line.update(lot_code="LATER-EXPIRED", lot_expires_at="2099-01-01")
    purchase = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload).json()
    lot_id = purchase["lines"][0]["lot_id"]
    path = f"/api/v1/work-orders/{order['id']}/materials"
    issued = client.post(path, headers=headers, json={"material_id": line["material_id"], "warehouse_id": line["warehouse_id"], "lot_id": lot_id, "quantity": "1"})
    assert issued.status_code == 201, issued.text
    db.get(InventoryLot, lot_id).expires_at = date(2000, 1, 1)
    db.commit()
    corrected = client.post(f"{path}/{issued.json()['id']}/reverse", headers=headers, json={"reason": "Corrección de consumo anterior a la caducidad"})
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["reversal_of_movement_id"] == issued.json()["id"]
    lots = client.get("/api/v1/inventory/lots", headers=headers).json()
    assert lots[0]["expiry_status"] == "expired"
    assert lots[0]["available_quantity"] == "5.000"


@pytest.mark.parametrize("offset,expected", [(0, "expiring"), (30, "expiring"), (31, "valid")])
def test_nonexpired_lot_is_consumable_and_api_exposes_warning(client, db, monkeypatch, offset, expected):
    from app.services import inventory_expiry_policy
    today = date(2026, 10, 31)
    monkeypatch.setattr(inventory_expiry_policy, "inventory_today", lambda: today)
    headers, payload = _setup(client, db, f"ExpiryBoundary-{offset}")
    line = payload["lines"][0]
    line.update(lot_code="BOUNDARY", lot_expires_at=(today + timedelta(days=offset)).isoformat())
    received = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert received.status_code == 201, received.text
    lots = client.get("/api/v1/inventory/lots", headers=headers).json()
    assert lots[0]["expiry_status"] == expected
    issued = client.post("/api/v1/inventory/movements", headers=headers, json={"material_id": line["material_id"], "warehouse_id": line["warehouse_id"], "lot_id": lots[0]["id"], "quantity": "1", "movement_type": "issue"})
    assert issued.status_code == 201, issued.text
