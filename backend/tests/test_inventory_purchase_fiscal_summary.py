"""Purchase corrections stay consistent with active expenses and tax summaries."""

import pytest

from tests.test_inventory_purchase_integrity import _setup, _snapshot


def _fiscal_summary(client, headers):
    response = client.get("/api/v1/fiscal-summary/?year=2026", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("consume_first", [False, True])
def test_purchase_tax_summary_tracks_successful_and_rejected_corrections(client, db, consume_first):
    headers, payload = _setup(client, db, f"PurchaseFiscal-{consume_first}")
    original_summary = _fiscal_summary(client, headers)
    response = client.post("/api/v1/inventory/purchases/", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    purchase = response.json()
    received_summary = _fiscal_summary(client, headers)
    for period in (received_summary["annual"], received_summary["periods"][2]):
        assert period["registered_expense_count"] == 1
        assert period["registered_expense_base_amount"] == "12.50"
        assert period["registered_input_vat_amount"] == "2.63"
        assert period["estimated_vat_balance"] == "-2.63"
    assert received_summary["periods"][:2] == original_summary["periods"][:2]
    assert received_summary["periods"][3] == original_summary["periods"][3]

    if consume_first:
        line = payload["lines"][0]
        consumed = client.post("/api/v1/inventory/movements", headers=headers, json={
            "material_id": line["material_id"], "warehouse_id": line["warehouse_id"],
            "movement_type": "issue", "quantity": "1.000",
        })
        assert consumed.status_code == 201, consumed.text
        assert _fiscal_summary(client, headers) == received_summary
    before = _snapshot(client, headers)
    corrected = client.post(
        f"/api/v1/inventory/purchases/{purchase['id']}/reverse",
        headers=headers, json={"reason": "QA fiscal correction"},
    )
    if consume_first:
        assert corrected.status_code == 409, corrected.text
        assert _fiscal_summary(client, headers) == received_summary
        assert _snapshot(client, headers) == before
    else:
        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["expense"]["is_active"] is False
        assert _fiscal_summary(client, headers) == original_summary
        history = client.get("/api/v1/inventory/purchases/", headers=headers)
        assert history.status_code == 200, history.text
        assert history.json()[0]["id"] == purchase["id"]
        assert history.json()[0]["status"] == "reversed"
        assert history.json()[0]["expense"]["tax_amount"] == 2.63
