
from uuid import uuid4
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location


def test_offline_report_retry_review_session_and_isolation(client, db):
    company = _company(db,"offline-work")
    admin = _bootstrap_admin(db,company,"offline-admin")
    headers = _headers(admin)
    customer = _client(client,headers)
    site = _location(client,headers,customer["id"])
    task = TaskItem(company_id=company.id,user_id=admin.id,location_id=site["id"],title="Parte offline",unit="service",price=100,status="accepted")
    db.add(task);db.commit()
    body = dict(event_id=str(uuid4()),task_id=task.id,starts_at="2026-11-16T08:00:00Z",ends_at="2026-11-16T10:00:00Z",
                paused_seconds=900,description="Trabajo realizado sin conexión.")
    base = "/api/v1/offline-work"
    created = client.post(base,headers=headers,json=body)
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]
    assert client.post(base,headers=headers,json=body).json()["id"] == report_id
    url = f"{base}/{report_id}/review"
    approved = client.post(url,headers=headers,json={"decision":"approved"})
    assert approved.status_code == 200, approved.text
    assert client.post(url,headers=headers,json={"decision":"approved"}).status_code == 200
    assert db.query(WorkSession).count() == 1
    assert db.query(WorkSession).first().paused_seconds == 900
    body["event_id"] = str(uuid4())
    overlapping = client.post(base,headers=headers,json=body)
    assert client.post(f"{base}/{overlapping.json()['id']}/review",headers=headers,json={"decision":"approved"}).status_code == 409
    other = _headers(_bootstrap_admin(db,_company(db,"offline-other"),"offline-other"))
    assert client.get(base+"?review=true",headers=other).json() == []
    assert client.post(url,headers=other,json={"decision":"approved"}).status_code == 404
