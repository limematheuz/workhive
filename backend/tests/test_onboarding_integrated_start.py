from app.models.location import Location
from tests.test_company_onboarding import _company, _headers, _payload
from test_service_contracts import _client
from tests.test_client_permission_authorization import _bootstrap_admin


def test_onboarding_connects_importable_client_center_staff_and_first_space_execution(client, db):
    company=_company(db,"StartupFlow")
    admin=_bootstrap_admin(db,company,"startup-admin")
    headers=_headers(admin)
    customer=_client(client,headers)
    payload=_payload()
    payload["location"]["client_id"]=customer["id"]
    payload["location"]["spaces"]=[{"name":"Despacho","space_type":"office","tasks":[{"title":"Limpiar mesas","estimated_minutes":30}]}]
    setup=client.post(f"/api/v1/companies/{company.id}/onboarding/complete",headers=headers,json=payload)
    assert setup.status_code==200,setup.text
    location_id=setup.json()["location_id"]
    assert db.get(Location,location_id).client_id==customer["id"]
    worker=client.post("/api/v1/staff",headers=headers,json={"name":"Ana Inicio","position":"Limpieza","team":"Inicial","monthly_hours":"160","hourly_cost":"15","profile":{"availability":"Nota conservada"}})
    assert worker.status_code==201,worker.text
    spaces=client.get(f"/api/v1/locations/{location_id}/spaces",headers=headers)
    assert spaces.status_code==200,spaces.text
    room=spaces.json()[0]
    planned=client.post("/api/v1/service-planning",headers=headers,json={"work_order":{"title":"Primera limpieza","location_id":location_id,"status":"active","order_type":"one_off","scheduled_start_at":"2026-11-20T08:00:00Z"},"spaces":[{"space_id":room["id"],"task_ids":[room["tasks"][0]["id"]],"employee_ids":[worker.json()["id"]],"crew_id":None}],"generate_first":True})
    assert planned.status_code==201,planned.text
    task=client.get(f"/api/v1/task-items/{planned.json()['task_id']}",headers=headers)
    assert task.status_code==200,task.text
    assert task.json()["spaces"][0]["id"]==room["id"]
    assert any(item["text"]=="Limpiar mesas" for item in task.json()["checklist_items"])


def test_onboarding_cannot_attach_another_company_client(client, db):
    owner=_company(db,"StartupOwn")
    outside=_company(db,"StartupOutside")
    admin=_bootstrap_admin(db,owner,"own-admin")
    other=_bootstrap_admin(db,outside,"outside-admin")
    foreign=_client(client,_headers(other))
    payload=_payload();payload["location"]["client_id"]=foreign["id"]
    response=client.post(f"/api/v1/companies/{owner.id}/onboarding/complete",headers=_headers(admin),json=payload)
    assert response.status_code==404,response.text
    assert not db.query(Location).filter_by(owner_company_id=owner.id).all()
