
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location, _accepted_quote
from app.models.task_item import TaskItem
from app.models.work_order import WorkOrder


def test_additional_request_accepted_price_once_and_tenant_boundary(client, db):
    company = _company(db, "extra-work")
    user = _bootstrap_admin(db, company, "extra-work")
    headers = _headers(user)
    customer = _client(client, headers)
    site = _location(client, headers, customer["id"])
    base = "/api/v1/additional-work"
    item = client.post(base, headers=headers, json={"title":"Cristales adicionales","location_id":site["id"]})
    assert item.status_code == 201, item.text
    detail = f"{base}/{item.json()['id']}"
    schedule = {"starts_at":"2026-11-30T09:00:00Z"}
    assert client.post(detail+"/schedule", headers=headers, json=schedule).status_code == 409
    quote = _accepted_quote(client, headers, customer["id"])
    linked = client.put(detail+"/quote", headers=headers, json={"quote_id":quote["id"]})
    assert linked.status_code == 200, linked.text
    contract = client.get("/api/v1/service-contracts/", headers=headers).json()[0]
    covered = client.post(f"/api/v1/service-contracts/{contract['id']}/locations", headers=headers,
                         json={"location_ids":[site["id"]]})
    assert covered.status_code == 200, covered.text
    activated = client.post(f"/api/v1/service-contracts/{contract['id']}/activate", headers=headers,
                            json={"location_ids":[site["id"]]})
    assert activated.status_code == 200, activated.text
    result = client.post(detail+"/schedule", headers=headers, json=schedule)
    assert result.status_code == 200, result.text
    task_id = result.json()["task_id"]
    assert db.get(TaskItem, task_id).price == 330
    assert client.post(detail+"/schedule", headers=headers, json=schedule).json()["task_id"] == task_id
    assert db.query(WorkOrder).count() == 1
    other = _headers(_bootstrap_admin(db, _company(db, "extra-other"), "extra-other"))
    assert client.get(base, headers=other).json() == []
    assert client.post(detail+"/schedule", headers=other, json=schedule).status_code == 404
