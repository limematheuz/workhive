from app.models.workforce_plan import TaskSpaceStaff,StaffChecklistProgress
from app.models.staff_employee import StaffEmployee
from app.models.task_item import TaskItem
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers
from test_service_contracts import _client,_location


def test_partial_location_plan_expands_real_crew_and_tracks_individual_work(client,db):
    company=_company(db,"space-plan")
    owner=_bootstrap_admin(db,company,"space-plan")
    headers=_headers(owner)
    customer=_client(client,headers)
    location=_location(client,headers,customer["id"],spaces=[{"name":"Planta uno","space_type":"office","tasks":[{"title":"Limpiar mesas","estimated_minutes":60}]},{"name":"Planta dos","space_type":"office","tasks":[{"title":"Aspirar","estimated_minutes":45}]}])
    spaces=client.get(f"/api/v1/locations/{location['id']}/spaces",headers=headers).json()
    workers=[StaffEmployee(company_id=company.id,name=name,position="Limpieza",team="",monthly_hours=160,hourly_cost=15) for name in ("María","Juan")]
    db.add_all(workers);db.commit()
    crew=client.post("/api/v1/work-crews",headers=headers,json={"name":"Equipo real","employee_ids":[p.id for p in workers]})
    assert crew.status_code==201,crew.text
    body={"work_order":{"title":"Solo planta uno","location_id":location["id"],"status":"active","scheduled_start_at":"2026-12-10T08:00:00Z"},"spaces":[{"space_id":spaces[0]["id"],"task_ids":[spaces[0]["tasks"][0]["id"]],"crew_id":crew.json()["id"]}]}
    created=client.post("/api/v1/service-planning",headers=headers,json=body)
    assert created.status_code==201,created.text
    task=db.get(TaskItem,created.json()["task_id"])
    assert len(task.checklist_items)==1 and task.checklist_items[0].text=="Limpiar mesas"
    assert len(task.zones)==1 and task.zones[0].zone_id==spaces[0]["id"]
    rows=client.get(f"/api/v1/workforce-execution/{task.id}",headers=headers).json()
    assert len(rows)==2 and all(row["total"]==1 and row["done"]==0 for row in rows)
    for index,row in enumerate(rows):
        marked=client.put(f"/api/v1/workforce-execution/{task.id}/{row['id']}/{row['tasks'][0]['id']}",headers=headers,json={"completed":True})
        assert marked.status_code==200,marked.text
        db.refresh(task.checklist_items[0]);assert task.checklist_items[0].completed==(index==1)
    other=_headers(_bootstrap_admin(db,_company(db,"space-other"),"space-other"))
    assert client.get(f"/api/v1/workforce-execution/{task.id}",headers=other).status_code==404
    body["spaces"][0]["task_ids"]=[spaces[1]["tasks"][0]["id"]]
    invalid=client.post("/api/v1/service-planning",headers=headers,json=body)
    assert invalid.status_code==422


def test_linked_worker_cannot_complete_other_workers_parts_through_shared_checklist(client,db):
    from app.models.staff_account import StaffAccount
    from tests.test_client_permission_authorization import _user
    company=_company(db,"space-accounts")
    owner=_bootstrap_admin(db,company,"space-account-owner");headers=_headers(owner)
    users=[_user(db,company,"space-worker-"+str(i),role_id=3) for i in range(2)]
    people=[StaffEmployee(company_id=company.id,name="Operario "+str(i),position="Limpieza",team="",monthly_hours=160,hourly_cost=15) for i in range(2)]
    db.add_all(people);db.flush()
    db.add_all([StaffAccount(company_id=company.id,employee_id=people[i].id,user_id=users[i].id) for i in range(2)]);db.commit()
    location=_location(client,headers,_client(client,headers)["id"],spaces=[{"name":"Sala","space_type":"office","tasks":[{"title":"Mesas","estimated_minutes":30}]}])
    space=client.get(f"/api/v1/locations/{location['id']}/spaces",headers=headers).json()[0]
    result=client.post("/api/v1/service-planning",headers=headers,json={"work_order":{"title":"Reparto","location_id":location["id"],"status":"active","scheduled_start_at":"2026-12-11T08:00:00Z"},"spaces":[{"space_id":space["id"],"task_ids":[space["tasks"][0]["id"]],"employee_ids":[p.id for p in people]}]})
    assert result.status_code==201,result.text
    task=db.get(TaskItem,result.json()["task_id"]);item=task.checklist_items[0]
    own_before=client.get(f"/api/v1/workforce-execution/{task.id}",headers=_headers(users[0])).json()[0]
    assert own_before["can_edit"] is False
    assert client.put(f"/api/v1/workforce-execution/{task.id}/{own_before['id']}/{item.id}",headers=_headers(users[0]),json={"completed":True}).status_code==409
    from app.models.work_session import WorkSession
    from datetime import datetime,timezone
    task.status="progress"
    db.add(WorkSession(user_id=users[0].id,task_item_id=task.id,location_id=location["id"],start_time=datetime.now(timezone.utc)))
    db.commit()
    first=client.patch(f"/api/v1/task-items/{task.id}/checklist-items/{item.id}",headers=_headers(users[0]),json={"completed":True,"answer":"yes"})
    assert first.status_code==200,first.text
    db.refresh(task);db.refresh(item)
    assert item.completed is False and task.status!="completed"
    assert task.checklist_evidence[f"item_{item.id}"]["answer"] is None
    own=client.get(f"/api/v1/workforce-execution/{task.id}",headers=_headers(users[0])).json()
    assert len(own)==1 and own[0]["done"]==1
    all_rows=client.get(f"/api/v1/workforce-execution/{task.id}",headers=headers).json()
    other_row=next(row for row in all_rows if row["employee_id"]==people[1].id)
    denied=client.put(f"/api/v1/workforce-execution/{task.id}/{other_row['id']}/{item.id}",headers=_headers(users[0]),json={"completed":True})
    assert denied.status_code==403
