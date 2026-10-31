"""Consumption requires inventory and work permissions within the owning tenant."""

import pytest

from app.models.permission_profile import MembershipPermissionProfileAssignment
from tests.test_client_permission_authorization import _assign_company_profile, _user
from tests.test_inventory_purchase_integrity import _snapshot
from tests.test_inventory_work_order_consumption import _inventory_company, _lot_receipt, _work_order
from tests.test_location_workspace import _admin, _headers


@pytest.mark.parametrize("principal", [
    "inventory_only", "work_only", "reader", "writer", "unassigned",
    "revoked", "foreign_admin", "anonymous",
])
def test_order_inventory_permission_matrix_preserves_denied_data(client, db, principal):
    company = _inventory_company(db, f"OrderInventory-{principal}")
    admin = _admin(db, company)
    owner_headers = _headers(admin)
    order = _work_order(client, db, owner_headers, company)
    material, warehouse, purchase = _lot_receipt(client, owner_headers)
    path = f"/api/v1/work-orders/{order['id']}/materials"
    payload = {
        "material_id": material["id"], "warehouse_id": warehouse["id"],
        "lot_id": purchase["lines"][0]["lot_id"], "quantity": "1.000",
    }
    original = client.post(path, headers=owner_headers, json=payload)
    assert original.status_code == 201, original.text
    before = _snapshot(client, owner_headers)
    if principal == "anonymous":
        headers = {}
    elif principal == "foreign_admin":
        foreign = _inventory_company(db, "ForeignOrderInventory")
        headers = _headers(_admin(db, foreign))
    else:
        actor = _user(db, company, f"order-inventory-{principal}", role_id=3)
        codes = {
            "inventory_only": {"inventory.read", "inventory.manage"},
            "work_only": {"work.read", "work.manage"},
            "reader": {"inventory.read", "work.read"},
            "writer": {"inventory.read", "inventory.manage", "work.read", "work.manage"},
            "revoked": {"inventory.read", "inventory.manage", "work.read", "work.manage"},
        }.get(principal)
        if codes:
            _assign_company_profile(
                db, company=company, admin=admin, user=actor,
                name=f"Order inventory {principal}", permission_codes=codes,
            )
        else:
            db.commit()
        headers = _headers(actor)
        if principal == "revoked":
            assert client.get(path, headers=headers).status_code == 200
            assignments = db.query(MembershipPermissionProfileAssignment).filter(
                MembershipPermissionProfileAssignment.permission_profile.has(name="Order inventory revoked")
            ).all()
            assert len(assignments) == 1
            assignments[0].is_active = False
            db.commit()
    denied_status = 401 if principal == "anonymous" else 404 if principal == "foreign_admin" else 403
    listed = client.get(path, headers=headers)
    if principal in {"reader", "writer"}:
        assert listed.status_code == 200, listed.text
        assert [item["id"] for item in listed.json()] == [original.json()["id"]]
    else:
        assert listed.status_code == denied_status, listed.text
    created = client.post(path, headers=headers, json=payload)
    if principal == "writer":
        assert created.status_code == 201, created.text
        assert created.json()["work_order_id"] == order["id"]
    else:
        assert created.status_code == denied_status, created.text
        assert _snapshot(client, owner_headers) == before
    corrected = client.post(
        f"{path}/{original.json()['id']}/reverse", headers=headers,
        json={"reason": "QA permission check"},
    )
    if principal == "writer":
        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["reversal_of_movement_id"] == original.json()["id"]
    else:
        assert corrected.status_code == denied_status, corrected.text
        assert _snapshot(client, owner_headers) == before
