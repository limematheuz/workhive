from tests.test_inventory_purchase_flow import (
    _catalogue,
    _inventory_company,
    _purchase_payload,
)
from tests.test_location_workspace import _admin, _headers


def _snapshot(client, headers):
    paths = ["inventory/purchases/", "expenses/", "inventory/lots", "inventory/movements", "inventory/stock"]
    result = {}
    for path in paths:
        response = client.get(f"/api/v1/{path}", headers=headers)
        assert response.status_code == 200, response.text
        result[path] = response.json()
    return result


def _setup(client, db, name):
    headers = _headers(_admin(db, _inventory_company(db, name)))
    supplier, material, warehouse = _catalogue(client, headers)
    return headers, _purchase_payload(supplier["id"], material["id"], warehouse["id"])


def test_mixed_lot_purchase_reversal_is_complete_and_cannot_be_duplicated(client, db):
    headers, payload = _setup(client, db, "MixedLotReversal")
    payload["lines"].append({**payload["lines"][0], "lot_code": "QA-MIX", "lot_expires_at": "2070-01-01"})
    response = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    purchase = response.json()
    corrected = client.post(f"/api/v1/inventory/purchases/{purchase['id']}/reverse", headers=headers, json={"reason": "Devolución QA"})
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["status"] == "reversed"
    assert corrected.json()["expense"]["is_active"] is False
    snapshot = _snapshot(client, headers)
    assert len(snapshot["inventory/movements"]) == 4
    assert snapshot["inventory/stock"][0]["available_quantity"] == "0.000"
    assert snapshot["inventory/lots"][0]["available_quantity"] == "0.000"
    duplicate = client.post(f"/api/v1/inventory/purchases/{purchase['id']}/reverse", headers=headers, json={"reason": "Segundo intento QA"})
    assert duplicate.status_code == 409, duplicate.text
    assert _snapshot(client, headers) == snapshot


def test_expiry_conflict_does_not_leave_purchase_expense_lot_or_receipt(client, db):
    headers, payload = _setup(client, db, "ExpiryAtomicity")
    line = payload["lines"][0]
    line.update(lot_code="QA-EXISTING", lot_expires_at="2070-01-01")
    assert client.post("/api/v1/inventory/purchases/", headers=headers, json=payload).status_code == 201
    before = _snapshot(client, headers)
    payload["lines"] = [
        {**line, "lot_code": "QA-NEW"},
        {**line, "lot_expires_at": "2070-02-01"},
    ]
    rejected = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert rejected.status_code == 409, rejected.text
    assert _snapshot(client, headers) == before
    db.commit()
    assert _snapshot(client, headers) == before


def test_later_expiry_conflict_restores_existing_lot_metadata(client, db):
    headers, payload = _setup(client, db, "ExpiryMetadataAtomicity")
    line = payload["lines"][0]
    payload["lines"] = [
        {**line, "lot_code": "QA-UNDATED"},
        {**line, "lot_code": "QA-DATED", "lot_expires_at": "2070-01-01"},
    ]
    assert client.post("/api/v1/inventory/purchases/", headers=headers, json=payload).status_code == 201
    before = _snapshot(client, headers)
    payload["lines"] = [
        {**line, "lot_code": "QA-UNDATED", "lot_expires_at": "2070-03-01"},
        {**line, "lot_code": "QA-DATED", "lot_expires_at": "2070-04-01"},
    ]
    rejected = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert rejected.status_code == 409, rejected.text
    assert _snapshot(client, headers) == before
    db.commit()
    assert _snapshot(client, headers) == before


def test_write_conflict_rolls_back_all_lines_and_allows_a_clean_retry(client, db, monkeypatch):
    from sqlalchemy.exc import IntegrityError

    from app.repositories import inventory_purchase as purchase_repo

    headers, payload = _setup(client, db, "PurchaseWriteConflict")
    line = payload["lines"][0]
    payload["lines"] = [{**line, "lot_code": "QA-A"}, {**line, "lot_code": "QA-B"}]
    before = _snapshot(client, headers)
    create_line = purchase_repo.create_purchase_line
    calls = 0

    def fail_second_line(session, **values):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise IntegrityError("QA simulated write conflict", {}, RuntimeError("QA"))
        return create_line(session, **values)

    monkeypatch.setattr(purchase_repo, "create_purchase_line", fail_second_line)
    rejected = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert rejected.status_code == 409, rejected.text
    assert _snapshot(client, headers) == before
    monkeypatch.setattr(purchase_repo, "create_purchase_line", create_line)
    retried = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert retried.status_code == 201, retried.text
    after = _snapshot(client, headers)
    assert len(after["inventory/purchases/"]) == 1
    assert len(after["expenses/"]) == 1
    assert len(after["inventory/movements"]) == 2
