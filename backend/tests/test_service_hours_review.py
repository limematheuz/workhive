from datetime import datetime, timedelta
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location


def test_review_matches_closed_sessions_and_excludes_other_companies(client, db):
    company = _company(db, "hours-control")
    admin = _bootstrap_admin(db, company, "hours-control-admin")
    headers = _headers(admin)
    customer = _client(client, headers)
    site = _location(client, headers, customer["id"])
    task = TaskItem(title="Cristales",company_id=company.id,location_id=site["id"],unit="h")
    db.add(task)
    db.flush()
    start = datetime(2026,11,16,8)
    log = WorkSession(start_time=start,end_time=start+timedelta(hours=2),paused_seconds=900,user_id=admin.id,location_id=site["id"],task_item_id=task.id)
    db.add(log)
    db.commit()
    url = "/api/v1/service-hours"
    detail = f"{url}/{task.id}"
    assert client.put(detail+"/contract",headers=headers,json={"minutes":120}).status_code == 200
    row = client.get(url,headers=headers).json()["items"][0]
    assert row["contract_minutes"] == 120 and row["worked_seconds"] == 6300
    assert client.post(detail+"/approval",headers=headers,json={"signature":row["signature"]}).status_code == 200
    assert client.get(url,headers=headers).json()["items"][0]["approved_seconds"] == 6300
    export_url = url + "/approved-export?month=2026-11"
    exported = client.get(export_url, headers=headers)
    assert exported.status_code == 200
    assert "Cristales" in exported.text and ";6300" in exported.text
    assert "Cristales" not in client.get(url + "/approved-export?month=2026-10", headers=headers).text
    log.paused_seconds = 0
    db.commit()
    assert client.get(url,headers=headers).json()["items"][0]["approved_seconds"] is None
    assert client.post(detail+"/approval",headers=headers,json={"signature":row["signature"]}).status_code == 409
    assert "Cristales" not in client.get(export_url, headers=headers).text
    external = _headers(_bootstrap_admin(db,_company(db,"hours-other"),"hours-other-user"))
    assert client.get(url,headers=external).json()["items"] == []
    assert client.put(detail+"/contract",headers=external,json={"minutes":150}).status_code == 404
