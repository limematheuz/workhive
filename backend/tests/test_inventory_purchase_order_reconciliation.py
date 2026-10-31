"""Reconcile purchase, order consumption, correction and fiscal history."""

from decimal import Decimal

from tests.test_inventory_purchase_flow import _catalogue, _inventory_company, _purchase_payload
from tests.test_inventory_purchase_fiscal_summary import _fiscal_summary
from tests.test_inventory_purchase_integrity import _snapshot
from tests.test_inventory_work_order_consumption import _client, _work_order
from tests.test_location_workspace import _admin, _headers


def test_order_consumption_must_be_corrected_before_returning_its_purchase(client, db):
    company = _inventory_company(db, "PurchaseOrderReconciliation")
    headers = _headers(_admin(db, company))
    customer = _client(db, company)
    order = _work_order(client, db, headers, company, client_id=customer.id)
    supplier, material, warehouse = _catalogue(client, headers)
    payload = _purchase_payload(supplier["id"], material["id"], warehouse["id"])
    payload["lines"][0].update(lot_code="QA-ORDER-RETURN", lot_expires_at="2070-01-01")
    original_fiscal = _fiscal_summary(client, headers)
    purchase_response = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert purchase_response.status_code == 201, purchase_response.text
    purchase = purchase_response.json()
    received_fiscal = _fiscal_summary(client, headers)
    assert received_fiscal["annual"]["registered_input_vat_amount"] == "2.63"
    path = f"/api/v1/work-orders/{order['id']}/materials"
    consumed = client.post(path, headers=headers, json={
        "material_id": material["id"], "warehouse_id": warehouse["id"],
        "lot_id": purchase["lines"][0]["lot_id"], "quantity": "3.000",
    })
    assert consumed.status_code == 201, consumed.text
    issue = consumed.json()
    assert issue["client_id"] == customer.id
    assert issue["work_order_id"] == order["id"]
    assert Decimal(issue["quantity"]) * Decimal(issue["unit_cost"]) == Decimal("7.5000000")
    after_issue = _snapshot(client, headers)
    assert after_issue["inventory/stock"][0]["available_quantity"] == "2.000"
    assert _fiscal_summary(client, headers) == received_fiscal

    return_path = f"/api/v1/inventory/purchases/{purchase['id']}/reverse"
    rejected = client.post(return_path, headers=headers, json={"reason": "QA return before restoring stock"})
    assert rejected.status_code == 409, rejected.text
    assert _snapshot(client, headers) == after_issue
    assert _fiscal_summary(client, headers) == received_fiscal

    correction_path = f"{path}/{issue['id']}/reverse"
    correction = client.post(correction_path, headers=headers, json={"reason": "QA wrong quantity"})
    assert correction.status_code == 200, correction.text
    assert correction.json()["reversal_of_movement_id"] == issue["id"]
    for field in ("quantity", "unit_cost", "client_id", "lot_id", "work_order_id"):
        assert correction.json()[field] == issue[field]
    restored = _snapshot(client, headers)
    assert restored["inventory/stock"][0]["available_quantity"] == "5.000"
    duplicate = client.post(correction_path, headers=headers, json={"reason": "QA duplicate correction"})
    assert duplicate.status_code == 409, duplicate.text
    assert _snapshot(client, headers) == restored

    returned = client.post(return_path, headers=headers, json={"reason": "QA full return after correction"})
    assert returned.status_code == 200, returned.text
    assert returned.json()["expense"]["is_active"] is False
    assert _fiscal_summary(client, headers) == original_fiscal
    final = _snapshot(client, headers)
    assert final["inventory/stock"][0]["available_quantity"] == "0.000"
    assert final["inventory/lots"][0]["available_quantity"] == "0.000"
    assert len(final["inventory/movements"]) == 4
    order_history = client.get(path, headers=headers)
    assert order_history.status_code == 200, order_history.text
    assert {item["id"] for item in order_history.json()} == {issue["id"], correction.json()["id"]}
