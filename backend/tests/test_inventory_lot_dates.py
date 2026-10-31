"""Lot dates stay valid and cannot silently replace an existing expiry."""

import pytest

from tests.test_inventory_purchase_integrity import _setup, _snapshot


@pytest.mark.parametrize("case", ["missing_code", "blank_code", "invalid_date", "time_in_date", "duplicate_code"])
def test_invalid_lot_dates_or_duplicate_lines_leave_no_records(client, db, case):
    headers, payload = _setup(client, db, f"LotDateValidation-{case}")
    line = payload["lines"][0]
    line.update(lot_code="QA-DATE", lot_expires_at="2027-12-31")
    if case == "missing_code":
        line.pop("lot_code")
    elif case == "blank_code":
        line["lot_code"] = "   "
    elif case == "invalid_date":
        line["lot_expires_at"] = "2027-02-30"
    elif case == "time_in_date":
        line["lot_expires_at"] = "2027-12-31T12:30:00Z"
    else:
        payload["lines"].append({**line, "lot_code": " QA-DATE "})
    before = _snapshot(client, headers)
    response = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert response.status_code == 422, response.text
    assert _snapshot(client, headers) == before


def test_reusing_a_lot_preserves_its_expiry_and_rejects_conflicting_dates(client, db):
    headers, payload = _setup(client, db, "LotDateReuse")
    line = payload["lines"][0]
    line.update(lot_code=" QA-DATE-REUSE ", lot_expires_at="2028-02-29")
    received = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert received.status_code == 201, received.text
    original_lot_id = received.json()["lines"][0]["lot_id"]
    line["lot_code"] = "QA-DATE-REUSE"
    line.pop("lot_expires_at")
    reused = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert reused.status_code == 201, reused.text
    assert reused.json()["lines"][0]["lot_id"] == original_lot_id
    lots = client.get("/api/v1/inventory/lots", headers=headers).json()
    assert len(lots) == 1
    assert lots[0]["expires_at"] == "2028-02-29"
    assert lots[0]["available_quantity"] == "10.000"
    before = _snapshot(client, headers)
    line["lot_expires_at"] = "2028-03-01"
    rejected = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert rejected.status_code == 409, rejected.text
    assert _snapshot(client, headers) == before
