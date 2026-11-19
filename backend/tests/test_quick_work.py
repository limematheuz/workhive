from datetime import datetime,timedelta,timezone
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.staff_employee import StaffEmployee
from app.models.workforce_plan import TaskSpaceStaff,StaffChecklistProgress
from tests.test_inventory_purchase_flow import _inventory_company
from tests.test_location_workspace import _admin,_headers
from tests.test_task_structure import _location

def setup(db,suffix):
    company=_inventory_company(db,suffix);owner=_admin(db,company);return company,owner,_headers(owner)

def payload(**values):
    return dict(title="Limpieza puntual",address="Calle de prueba 12",city="Barcelona",scheduled_start_at=(datetime.now(timezone.utc)+timedelta(days=2)).isoformat(),duration_minutes=60,tasks=["Limpiar superficies","Fregar suelo"],**values)

def test_temporary_address_needs_no_master_spaces_and_has_individual_progress(client,db):
    company,owner,headers=setup(db,"quick-general")
    person=StaffEmployee(company_id=company.id,name="Personal sin acceso",position="Limpieza",team="",monthly_hours=160,hourly_cost=15,profile={});db.add(person);db.commit()
    response=client.post("/api/v1/quick-work",headers=headers,json=payload(employee_ids=[person.id]))
    assert response.status_code==201,response.text
    result=response.json();task=db.get(TaskItem,result["task_id"]);site=db.get(Location,result["location_id"])
    assert site.is_temporary and not task.zones and len(task.checklist_items)==2
    row=db.query(TaskSpaceStaff).filter_by(task_id=task.id).one();assert row.space_id is None and row.employee_id==person.id
    assert db.query(StaffChecklistProgress).filter_by(allocation_id=row.id).count()==2
    listing=client.get("/api/v1/locations/",headers=headers);assert listing.status_code==200 and site.id not in {row["id"] for row in listing.json()}
    progress=client.get(f"/api/v1/workforce-execution/{task.id}",headers=headers);assert progress.status_code==200,progress.text
    assert progress.json()[0]["total"]==2 and progress.json()[0]["space_id"] is None
    # A conflicting job rolls back its address, task, assignments and progress together.
    before=(db.query(Location).count(),db.query(TaskItem).count())
    conflict=client.post("/api/v1/quick-work",headers=headers,json=payload(employee_ids=[person.id]))
    assert conflict.status_code==409,conflict.text
    assert (db.query(Location).count(),db.query(TaskItem).count())==before

def test_existing_center_and_optional_persistent_address(client,db):
    company,owner,headers=setup(db,"quick-known");site=_location(db,company)
    data=payload();data.pop("address");data.pop("city");data["location_id"]=site.id
    response=client.post("/api/v1/quick-work",headers=headers,json=data);assert response.status_code==201,response.text
    assert response.json()["location_id"]==site.id and response.json()["temporary_address"] is False
    saved=client.post("/api/v1/quick-work",headers=headers,json=payload(save_location=True));assert saved.status_code==201,saved.text
    assert not db.get(Location,saved.json()["location_id"]).is_temporary

def test_foreign_assignment_is_denied_without_persisting_a_temporary_address(client,db):
    company,owner,headers=setup(db,"quick-tenant");other,_,foreign=setup(db,"quick-other")
    person=StaffEmployee(company_id=other.id,name="Ajeno",position="Limpieza",team="",monthly_hours=160,hourly_cost=15);db.add(person);db.commit();before=db.query(Location).count()
    denied=client.post("/api/v1/quick-work",headers=headers,json=payload(employee_ids=[person.id]));assert denied.status_code==422,denied.text
    assert db.query(Location).count()==before and db.query(TaskItem).count()==0
    site=_location(db,other);data=payload();data.pop("address");data.pop("city");data["location_id"]=site.id
    assert client.post("/api/v1/quick-work",headers=headers,json=data).status_code in {403,404}


def test_general_worker_answer_preserves_no_without_completing_other_workers(client,db):
    company,owner,headers=setup(db,"quick-no-answer")
    people=[StaffEmployee(company_id=company.id,name="Equipo "+str(i),position="Limpieza",team="",monthly_hours=160,hourly_cost=15,profile={}) for i in range(2)];db.add_all(people);db.commit()
    response=client.post("/api/v1/quick-work",headers=headers,json=payload(employee_ids=[person.id for person in people]));assert response.status_code==201,response.text
    id=response.json()["task_id"];rows=client.get(f"/api/v1/workforce-execution/{id}",headers=headers).json();first=rows[0];check=first["tasks"][0]["id"]
    marked=client.put(f"/api/v1/workforce-execution/{id}/{first['id']}/{check}",headers=headers,json={"completed":True,"answer":"no"});assert marked.status_code==200,marked.text
    first=next(row for row in marked.json() if row["id"]==first["id"]);assert first["tasks"][0]["answer"]=="no" and first["done"]==1
    other=next(row for row in marked.json() if row["id"]!=first["id"]);assert other["done"]==0 and other["tasks"][0]["answer"] is None
    cleared=client.put(f"/api/v1/workforce-execution/{id}/{first['id']}/{check}",headers=headers,json={"completed":False});assert cleared.status_code==200
    assert next(row for row in cleared.json() if row["id"]==first["id"])["tasks"][0]["answer"] is None


def test_location_scoped_planner_can_prepare_own_center_but_not_other_or_temporary_address(client,db):
    from tests.test_client_permission_authorization import _user,_assign_company_profile
    company,admin,_=setup(db,"quick-scoped")
    allowed=_location(db,company);blocked=_location(db,company)
    planner=_user(db,company,"quick-scoped-planner",3)
    _assign_company_profile(db,company=company,admin=admin,user=planner,name="Planificar un centro",permission_codes={"locations.read","work.read","work.manage"},scope_type="location",scope_id=allowed.id)
    headers=_headers(planner)
    initial=client.get("/api/v1/quick-work/choices",headers=headers)
    assert initial.status_code==200 and initial.json()["can_create_address"] is False and initial.json()["people"]==[]
    assert client.get(f"/api/v1/quick-work/choices?location_id={allowed.id}",headers=headers).status_code==200
    assert client.get(f"/api/v1/quick-work/choices?location_id={blocked.id}",headers=headers).status_code in {403,404}
    data=payload();data.pop("address");data.pop("city");data["location_id"]=allowed.id
    created=client.post("/api/v1/quick-work",headers=headers,json=data);assert created.status_code==201,created.text
    data["location_id"]=blocked.id
    assert client.post("/api/v1/quick-work",headers=headers,json=data).status_code in {403,404}
    assert client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"work","records":[data]}).status_code in {403,404}
    data["location_id"]=allowed.id;data["title"]="Servicio importado de mi centro"
    imported=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"work","records":[data]})
    assert imported.status_code==200,imported.text
    assert client.post("/api/v1/quick-work",headers=headers,json=payload()).status_code==403
