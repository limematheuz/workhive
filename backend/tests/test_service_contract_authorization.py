"""Contract capabilities protect every transport path and preserve denied data."""

import pytest

from app.models.audit_log import AuditLog
from app.models.permission_profile import MembershipPermissionProfileAssignment
from app.models.service_contract import ServiceContract
from app.models.task_item import TaskItem
from test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)
from test_service_contracts import _accepted_quote, _client, _location


@pytest.fixture()
def agreement(client, db):
    company = _company(db, "contract-access")
    admin = _bootstrap_admin(db, company, "contract-owner")
    headers = _headers(admin)
    customer = _client(client, headers)
    location = _location(
        client, headers, customer["id"],
        spaces=[{"name": "Contract zone", "space_type": "office"}],
    )
    quote = _accepted_quote(client, headers, customer["id"])
    response = client.get("/api/v1/service-contracts/", headers=headers)
    assert response.status_code == 200, response.text
    contract = response.json()[0]
    path = f"/api/v1/service-contracts/{contract['id']}"
    attached = client.post(
        f"{path}/locations", headers=headers,
        json={"location_ids": [location["id"]]},
    )
    assert attached.status_code == 200, attached.text
    zones = client.get(
        f"{path}/locations/{location['id']}/zone-candidates", headers=headers,
    )
    assert zones.status_code == 200, zones.text
    restricted = client.put(
        f"{path}/locations/{location['id']}/zones", headers=headers,
        json={"zone_ids": [zones.json()[0]["id"]]},
    )
    assert restricted.status_code == 200, restricted.text
    return company, admin, headers, quote, location, path, restricted.json()


@pytest.mark.parametrize("principal", [
    "reader", "commercial", "location_reader", "unassigned", "revoked_reader",
    "foreign_admin", "anonymous",
])
def test_contract_access_matrix_denies_every_unauthorized_operation(client, db, agreement, principal):
    company, admin, owner_headers, quote, location, path, original = agreement
    status = 403
    if principal == "anonymous":
        headers = {}
        status = 401
    elif principal == "foreign_admin":
        foreign = _company(db, "contract-foreign")
        headers = _headers(_bootstrap_admin(db, foreign, "contract-foreign-admin"))
        status = 404
    else:
        actor = _user(db, company, f"contract-{principal}", role_id=2 if principal == "commercial" else 3)
        if principal != "unassigned":
            _assign_company_profile(
                db, company=company, admin=admin, user=actor,
                name=f"Contract {principal}",
                permission_codes={"clients.read", "clients.manage"} if principal == "commercial" else {"finance.read"},
                scope_type="location" if principal == "location_reader" else "company",
                scope_id=location["id"] if principal == "location_reader" else None,
            )
        else:
            db.commit()
        headers = _headers(actor)
        if principal == "revoked_reader":
            permitted = client.get(path, headers=headers)
            assert permitted.status_code == 200, permitted.text
            assignments = db.query(MembershipPermissionProfileAssignment).filter(
                MembershipPermissionProfileAssignment.permission_profile.has(name="Contract revoked_reader")
            ).all()
            assert len(assignments) == 1
            assignments[0].is_active = False
            db.commit()

    audit_count = db.query(AuditLog).count()
    contract_count = db.query(ServiceContract).count()
    task_count = db.query(TaskItem).count()
    listed = client.get("/api/v1/service-contracts/", headers=headers)
    if principal == "reader":
        assert listed.status_code == 200, listed.text
        assert [item["id"] for item in listed.json()] == [original["id"]]
        detail = client.get(path, headers=headers)
        assert detail.status_code == 200, detail.text
        assert detail.json() == original
    elif principal == "foreign_admin":
        assert listed.status_code == 200, listed.text
        assert listed.json() == []
        assert client.get(path, headers=headers).status_code == status
    else:
        assert listed.status_code == status, listed.text
        assert client.get(path, headers=headers).status_code == status

    coverage = f"{path}/locations/{location['id']}"
    operations = [
        ("GET", f"{path}/location-candidates", None),
        ("GET", f"{coverage}/zone-candidates", None),
        ("PATCH", path, {"notes": "Denied update", "renewal_notice_days": 45}),
        ("POST", f"{path}/activate", None),
        ("POST", f"{path}/locations", {"location_ids": [location["id"]]}),
        ("PUT", f"{coverage}/zones", {"zone_ids": []}),
        ("DELETE", coverage, None),
        ("POST", f"/api/v1/service-contracts/from-quote/{quote['id']}", None),
    ]
    for method, endpoint, payload in operations:
        response = client.request(method, endpoint, headers=headers, **({"json": payload} if payload is not None else {}))
        assert response.status_code == status, (method, endpoint, response.text)
        unchanged = client.get(path, headers=owner_headers)
        assert unchanged.status_code == 200, unchanged.text
        assert unchanged.json() == original
        assert db.query(AuditLog).count() == audit_count
        assert db.query(ServiceContract).count() == contract_count
        assert db.query(TaskItem).count() == task_count


def test_contract_owner_can_manage_and_finance_reader_sees_persisted_result(client, db, agreement):
    company, admin, headers, quote, location, path, original = agreement
    reader = _user(db, company, "contract-persisted-reader", role_id=3)
    _assign_company_profile(
        db, company=company, admin=admin, user=reader,
        name="Contract persisted reader", permission_codes={"finance.read"},
    )
    candidates = client.get(f"{path}/location-candidates", headers=headers)
    assert candidates.status_code == 200, candidates.text
    assert [item["id"] for item in candidates.json()] == [location["id"]]
    saved = client.patch(path, headers=headers, json={"notes": "Authorized update", "renewal_notice_days": 45})
    assert saved.status_code == 200, saved.text
    activated = client.post(f"{path}/activate", headers=headers)
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == "active"
    removed = client.delete(f"{path}/locations/{location['id']}", headers=headers)
    assert removed.status_code == 200, removed.text
    assert removed.json()["covered_locations"][0]["is_active"] is False
    restored = client.post(f"{path}/locations", headers=headers, json={"location_ids": [location["id"]]})
    assert restored.status_code == 200, restored.text
    recovered = client.post(f"/api/v1/service-contracts/from-quote/{quote['id']}", headers=headers)
    assert recovered.status_code == 201, recovered.text
    assert recovered.json()["id"] == original["id"]
    persisted = client.get(path, headers=_headers(reader))
    assert persisted.status_code == 200, persisted.text
    assert persisted.json() == recovered.json()
    assert persisted.json()["notes"] == "Authorized update"
    assert persisted.json()["renewal_notice_days"] == 45
    for field in ("source_quote_id", "source_quote_revision_id", "quote_snapshot", "service_lines", "covered_locations"):
        assert persisted.json()[field] == original[field]
    assert db.query(ServiceContract).count() == 1
    assert db.query(TaskItem).count() == 0
    events = db.query(AuditLog).filter(AuditLog.entity_type == "service_contract").all()
    assert {event.action for event in events} >= {
        "service_contract.terms_updated", "service_contract.activated",
        "service_contract.location_removed", "service_contract.locations_added",
        "service_contract.location_zones_updated", "service_contract.created_from_quote",
    }
    assert all(event.company_id == company.id and event.actor_user_id == admin.id for event in events)
