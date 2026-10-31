"""Inventory purchases require both inventory and finance capabilities."""

import pytest

from app.models.permission_profile import MembershipPermissionProfileAssignment
from tests.test_client_permission_authorization import _assign_company_profile, _user
from tests.test_inventory_purchase_flow import _catalogue, _inventory_company, _purchase_payload
from tests.test_inventory_purchase_integrity import _snapshot
from tests.test_location_workspace import _admin, _headers


@pytest.mark.parametrize("principal", [
    "inventory_only", "finance_only", "reader", "forged_writer", "admin", "unassigned",
    "revoked", "foreign_admin", "anonymous",
])
def test_purchase_capability_matrix_preserves_denied_data(client, db, principal):
    company = _inventory_company(db, f"PurchaseMatrix-{principal}")
    admin = _admin(db, company)
    owner_headers = _headers(admin)
    supplier, material, warehouse = _catalogue(client, owner_headers)
    payload = _purchase_payload(supplier["id"], material["id"], warehouse["id"])
    created = client.post("/api/v1/inventory/purchases/", headers=owner_headers, json=payload)
    assert created.status_code == 201, created.text
    purchase_id = created.json()["id"]
    before = _snapshot(client, owner_headers)
    if principal == "admin":
        headers = owner_headers
    elif principal == "anonymous":
        headers = {}
    elif principal == "foreign_admin":
        foreign = _inventory_company(db, "PurchaseMatrix-foreign")
        headers = _headers(_admin(db, foreign))
    else:
        actor = _user(db, company, f"purchase-{principal}", role_id=3)
        codes = {
            "inventory_only": {"inventory.read", "inventory.manage"},
            "finance_only": {"finance.read"},
            "reader": {"inventory.read", "finance.read"},
            "forged_writer": {"inventory.read", "inventory.manage", "finance.read", "finance.manage"},
            "revoked": {"inventory.read", "finance.read"},
        }.get(principal)
        if codes:
            _assign_company_profile(
                db, company=company, admin=admin, user=actor,
                name=f"Purchase {principal}", permission_codes=codes,
            )
        else:
            db.commit()
        headers = _headers(actor)
        if principal == "revoked":
            assert client.get("/api/v1/inventory/purchases/", headers=headers).status_code == 200
            assignments = db.query(MembershipPermissionProfileAssignment).filter(
                MembershipPermissionProfileAssignment.permission_profile.has(name="Purchase revoked")
            ).all()
            assert len(assignments) == 1
            assignments[0].is_active = False
            db.commit()

    listed = client.get("/api/v1/inventory/purchases/", headers=headers)
    if principal in {"reader", "forged_writer", "admin"}:
        assert listed.status_code == 200, listed.text
        assert [item["id"] for item in listed.json()] == [purchase_id]
    elif principal == "foreign_admin":
        assert listed.status_code == 200, listed.text
        assert listed.json() == []
    else:
        assert listed.status_code == (401 if principal == "anonymous" else 403), listed.text

    write_status = 401 if principal == "anonymous" else 404 if principal == "foreign_admin" else 403
    posted = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    if principal == "admin":
        assert posted.status_code == 201, posted.text
    else:
        assert posted.status_code == write_status, posted.text
        assert _snapshot(client, owner_headers) == before
    reversed_response = client.post(
        f"/api/v1/inventory/purchases/{purchase_id}/reverse",
        headers=headers, json={"reason": "QA permission matrix"},
    )
    if principal == "admin":
        assert reversed_response.status_code == 200, reversed_response.text
        assert reversed_response.json()["status"] == "reversed"
        assert reversed_response.json()["expense"]["is_active"] is False
    else:
        assert reversed_response.status_code == write_status, reversed_response.text
        assert _snapshot(client, owner_headers) == before
