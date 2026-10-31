"""Archived catalogue entries remain readable in an authorized order history."""

import pytest

from tests.test_inventory_purchase_flow import _catalogue, _purchase_payload
from tests.test_inventory_work_order_consumption import _inventory_company, _lot_receipt, _work_order
from tests.test_location_workspace import _admin, _headers


@pytest.mark.parametrize("with_lot", [True, False])
def test_order_history_keeps_catalogue_names_and_lot_after_archiving(client, db, with_lot):
    company = _inventory_company(db, "ArchivedOrderHistory")
    headers = _headers(_admin(db, company))
    order = _work_order(client, db, headers, company)
    if with_lot:
        material, warehouse, purchase = _lot_receipt(client, headers)
    else:
        supplier, material, warehouse = _catalogue(client, headers)
        received = client.post("/api/v1/inventory/purchases/", headers=headers, json=_purchase_payload(supplier["id"], material["id"], warehouse["id"]))
        assert received.status_code == 201, received.text
        purchase = received.json()
    path = f"/api/v1/work-orders/{order['id']}/materials"
    issue = client.post(path, headers=headers, json={
        "material_id": material["id"], "warehouse_id": warehouse["id"],
        "lot_id": purchase["lines"][0]["lot_id"], "quantity": "3.000",
    })
    assert issue.status_code == 201, issue.text
    corrected = client.post(f"{path}/{issue.json()['id']}/reverse", headers=headers, json={"reason": "QA return"})
    assert corrected.status_code == 200, corrected.text
    returned = client.post(f"/api/v1/inventory/purchases/{purchase['id']}/reverse", headers=headers, json={"reason": "QA full return"})
    assert returned.status_code == 200, returned.text
    before = client.get(path, headers=headers)
    assert before.status_code == 200, before.text
    for endpoint, identifier in (("materials", material["id"]), ("warehouses", warehouse["id"]), ("suppliers", purchase["supplier_id"])):
        archived = client.delete(f"/api/v1/inventory/{endpoint}/{identifier}", headers=headers)
        assert archived.status_code == 204, archived.text
        assert client.get(f"/api/v1/inventory/{endpoint}", headers=headers).json() == []
    assert client.get("/api/v1/inventory/lots", headers=headers).json() == []
    after = client.get(path, headers=headers)
    assert after.status_code == 200, after.text
    assert after.json() == before.json()
    assert len(after.json()) == 2
    for movement in after.json():
        assert movement["material_name"] == material["name"]
        assert movement["warehouse_name"] == warehouse["name"]
        assert movement["lot_code"] == ("L-2026-10" if with_lot else None)
        assert movement["unit_cost"] == "2.5000"
    foreign = _inventory_company(db, "ArchivedOrderForeign")
    denied = client.get(path, headers=_headers(_admin(db, foreign)))
    assert denied.status_code == 404, denied.text
    assert client.get(path, headers=headers).json() == after.json()
