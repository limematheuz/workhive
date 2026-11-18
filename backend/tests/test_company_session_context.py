import jwt
from datetime import datetime,timedelta,timezone
from app.core.config import settings
from app.core.security import create_access_token,get_password_hash
from app.models.company_membership import CompanyMembership
from app.models.permission_profile import PermissionProfile,PermissionProfilePermission,PermissionDefinition,MembershipPermissionProfileAssignment,MembershipPermissionProfileScope
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers
from tests.credentials import TEST_SECRET


def fixture(db,with_profile=True):
    first=_company(db,"context-first");second=_company(db,"context-second")
    user=_bootstrap_admin(db,first,"context-person");owner=_bootstrap_admin(db,second,"context-owner")
    user.email="context-person@example.com";owner.email="context-owner@example.com"
    member=CompanyMembership(company_id=second.id,user_id=user.id,access_class="worker",status="active",permissions_configured=with_profile)
    db.add(member);db.flush()
    profile=PermissionProfile(company_id=second.id,name="Tareas propias",is_active=True,is_system=False)
    db.add(profile);db.flush()
    for definition in db.query(PermissionDefinition).filter(PermissionDefinition.code.in_({"locations.read","work.read","time.read","time.manage"})).all():
        db.add(PermissionProfilePermission(permission_profile_id=profile.id,permission_definition_id=definition.id))
    assignment=MembershipPermissionProfileAssignment(company_id=second.id,company_membership_id=member.id,permission_profile_id=profile.id,assigned_by_user_id=owner.id,is_active=True)
    if with_profile:
        db.add(assignment);db.flush();db.add(MembershipPermissionProfileScope(company_id=second.id,profile_assignment_id=assignment.id,scope_type="company",scope_id=second.id))
    locations=[]
    for company in (first,second):
        location=Location(name=company.name,address="Test address",city="Madrid",owner_company_id=company.id,managing_company_id=company.id)
        db.add(location);db.flush();locations.append(location)
    db.commit()
    return first,second,user,owner,member,assignment,locations


def switch(client,user,company):
    response=client.post("/api/v1/session/company",headers=_headers(user),json={"company_id":company.id})
    assert response.status_code==200,response.text
    return {"Authorization":"Bearer "+response.json()["access_token"]}


def test_company_switch_changes_principal_without_rewriting_identity_or_legacy_privileges(client,db):
    first,second,user,owner,member,assignment,locations=fixture(db)
    result=client.get("/api/v1/session/companies",headers=_headers(user));assert result.status_code==200,result.text
    assert {c["id"] for c in result.json()["companies"]}=={first.id,second.id}
    headers=switch(client,user,second)
    payload=jwt.decode(headers["Authorization"].split()[1],settings.SECRET_KEY,algorithms=[settings.ALGORITHM])
    assert payload["company_id"]==second.id
    me=client.get("/api/v1/users/me",headers=headers);assert me.status_code==200,me.text
    assert me.json()["company_id"]==second.id and me.json()["role"]["name"]=="viewer"
    assert me.json()["can_manage_finance"] is False and me.json()["can_view_labor_costs"] is False
    assert me.json()["can_manage_work"] is False
    assert client.get("/api/v1/staff",headers=headers).status_code==403
    assert client.get("/api/v1/users/",headers=headers).status_code==403
    assert client.post("/api/v1/clients/",headers=headers,json={"name":"Denied","address":"Test","city":"Madrid","postal_code":"28001","country":"ES"}).status_code==403
    db.refresh(user);assert user.company_id==first.id and user.role.name=="admin"
    assert db.get(CompanyMembership,member.id).access_class=="worker"


def test_company_context_revalidates_membership_profile_and_rejects_claims_without_grant(client,db):
    first,second,user,owner,member,assignment,locations=fixture(db)
    headers=switch(client,user,second)
    assert client.get("/api/v1/task-items/",headers=headers).status_code==200
    assignment.is_active=False;db.commit()
    assert client.get("/api/v1/task-items/",headers=headers).status_code==403
    member.status="archived";member.ended_at=datetime.now(timezone.utc);db.commit()
    assert client.get("/api/v1/users/me",headers=headers).status_code==403
    assert client.post("/api/v1/session/company",headers=_headers(user),json={"company_id":second.id}).status_code==403
    foreign=_company(db,"context-foreign");db.commit()
    forged=create_access_token({"sub":user.email,"ver":user.session_version,"company_id":foreign.id})
    assert client.get("/api/v1/users/me",headers={"Authorization":"Bearer "+forged}).status_code==403
    invalid=create_access_token({"sub":user.email,"ver":user.session_version,"company_id":True})
    assert client.get("/api/v1/users/me",headers={"Authorization":"Bearer "+invalid}).status_code==401
    db.refresh(member);assert member.status=="archived"


def test_company_session_isolates_stats_and_blocks_switch_with_global_active_work(client,db):
    first,second,user,owner,member,assignment,locations=fixture(db)
    headers=switch(client,user,second)
    now=datetime.now(timezone.utc)
    tasks=[]
    for company,location in zip((first,second),locations):
        task=TaskItem(company_id=company.id,location_id=location.id,user_id=user.id,title="Scope "+company.name,status="completed",description="",quantity=1,price=10,unit="service")
        db.add(task);db.flush();tasks.append(task)
        db.add(WorkSession(company_id=company.id,user_id=user.id,location_id=location.id,task_item_id=task.id,start_time=now-timedelta(hours=1),end_time=now))
    db.commit()
    stats=client.get(f"/api/v1/users/{user.id}/stats",headers=headers)
    assert stats.status_code==200,stats.text
    assert stats.json()["total_hours_worked"]==1 and stats.json()["total_tasks"]==1
    history=client.get("/api/v1/work-sessions/",headers=headers)
    assert history.status_code==200,history.text
    assert len(history.json())==1 and history.json()[0]["task_item_id"]==tasks[1].id
    open_session=WorkSession(company_id=first.id,user_id=user.id,location_id=locations[0].id,start_time=now)
    db.add(open_session);db.commit()
    assert client.post("/api/v1/session/company",headers=_headers(user),json={"company_id":second.id}).status_code==409
    assert client.get("/api/v1/users/me",headers=headers).json()["active_location_id"] is None
    assert client.get("/api/v1/work-sessions/active",headers=headers).json() is None
    assert client.post("/api/v1/work-sessions/stop",headers=headers).status_code==409
    db.refresh(open_session);assert open_session.end_time is None


def test_company_switch_uses_cookie_csrf_and_logout_unwraps_identity(client,db):
    first,second,user,owner,member,assignment,locations=fixture(db)
    user.hashed_password=get_password_hash(TEST_SECRET);db.commit()
    login=client.post("/api/v1/auth/login",data={"username":user.email,"password":TEST_SECRET})
    assert login.status_code==200,login.text
    assert client.post("/api/v1/session/company",json={"company_id":second.id}).status_code==403
    switched=client.post("/api/v1/session/company",headers={"X-CSRF-Token":login.json()["csrf_token"]},json={"company_id":second.id})
    assert switched.status_code==200,switched.text
    assert switched.json()["csrf_token"]!=login.json()["csrf_token"]
    version=user.session_version
    logout=client.post("/api/v1/auth/logout",headers={"X-CSRF-Token":switched.json()["csrf_token"]})
    assert logout.status_code==204,logout.text
    db.refresh(user);assert user.session_version==version+1 and user.company_id==first.id


def test_initial_membership_worker_has_own_operations_without_inheriting_identity_admin(client,db):
    from app.models.notification import Notification
    first,second,user,owner,member,_,locations=fixture(db,False)
    headers=switch(client,user,second)
    rows=[]
    for person,title in ((user,"Trabajo propio B"),(owner,"Trabajo ajeno B")):
        response=client.post("/api/v1/task-items/",headers=_headers(owner),json={"title":title,"unit":"servicio","location_id":locations[1].id,"user_id":person.id,"status":"accepted","price":25})
        assert response.status_code==201,response.text
        rows.append(response.json())
        accepted=client.patch(f"/api/v1/task-items/{response.json()['id']}",headers=_headers(owner),json={"status":"accepted"})
        assert accepted.status_code==200,accepted.text
    own,other=rows
    listed=client.get("/api/v1/task-items/",headers=headers)
    assert listed.status_code==200,listed.text
    assert [r["id"] for r in listed.json()]==[own["id"]]
    assert listed.json()[0]["price"] is None
    assert client.get(f"/api/v1/task-items/{other['id']}",headers=headers).status_code==404
    assert client.get(f"/api/v1/workforce-execution/{other['id']}",headers=headers).status_code in (403,404)
    for path in ("/api/v1/staff","/api/v1/transaction-currency","/api/v1/work-orders/","/api/v1/work-sessions/company/active","/api/v1/users/"):
        assert client.get(path,headers=headers).status_code==403,path
    notifications=db.query(Notification).filter_by(user_id=user.id,entity_id=own["id"],event_type="task.assigned").all()
    assert notifications and {n.company_id for n in notifications}=={second.id}
    started=client.post(f"/api/v1/task-items/{own['id']}/start-work",headers=headers,json={"start_latitude":0,"start_longitude":0})
    assert started.status_code==200,started.text
    active=db.query(WorkSession).filter_by(user_id=user.id,end_time=None).one()
    assert active.company_id==second.id
    now=datetime.now(timezone.utc)
    db.add(WorkSession(company_id=second.id,user_id=owner.id,location_id=locations[1].id,task_item_id=own["id"],start_time=now-timedelta(hours=2),end_time=now));db.commit()
    summary=client.get(f"/api/v1/work-sessions/task/{own['id']}/summary",headers=headers)
    assert summary.status_code==200,summary.text
    assert summary.json()["session_count"]==1
    assert client.post("/api/v1/session/company",headers=headers,json={"company_id":first.id}).status_code==409
    finished=client.post(f"/api/v1/task-items/{own['id']}/finish-work",headers=headers,json={})
    assert finished.status_code==200,finished.text
    db.refresh(active);assert active.end_time is not None and active.company_id==second.id
    member.permissions_configured=True;db.commit()
    assert client.get("/api/v1/task-items/",headers=headers).status_code==403
    db.refresh(user);assert user.role.name=="admin" and user.company_id==first.id


def test_initial_responsible_is_operational_and_cannot_reprice_or_read_company_costs(client,db):
    first,second,user,owner,member,_,locations=fixture(db,False)
    member.access_class="responsible";db.commit();headers=switch(client,user,second)
    created=client.post("/api/v1/task-items/",headers=headers,json={"title":"Servicio operativo","unit":"servicio","location_id":locations[1].id})
    assert created.status_code==201,created.text
    priced=client.post("/api/v1/task-items/",headers=headers,json={"title":"Precio no autorizado","unit":"servicio","location_id":locations[1].id,"price":200})
    assert priced.status_code==403
    assert client.patch(f"/api/v1/task-items/{created.json()['id']}",headers=headers,json={"price":200}).status_code==403
    assert client.get("/api/v1/transaction-currency",headers=headers).status_code==403
    assert client.get("/api/v1/staff",headers=headers).status_code==403
    assert client.get("/api/v1/users/",headers=headers).status_code==403
    member.status="suspended";db.commit()
    assert client.get("/api/v1/task-items/",headers=headers).status_code==403


def test_user_directory_projects_membership_role_and_never_revives_archived_identity(client,db):
    first,second,user,owner,member,_,locations=fixture(db)
    listed=client.get("/api/v1/users/",headers=_headers(owner))
    assert listed.status_code==200,listed.text
    person=next(row for row in listed.json() if row["id"]==user.id)
    assert person["company_id"]==second.id and person["role"]["name"]=="viewer"
    assert client.patch(f"/api/v1/users/{user.id}",headers=_headers(owner),json={"password":TEST_SECRET}).status_code==403
    member.status="archived";db.commit()
    listed=client.get("/api/v1/users/",headers=_headers(owner));assert listed.status_code==200,listed.text
    assert user.id not in {row["id"] for row in listed.json()}
    db.refresh(user);assert user.company_id==first.id and user.role.name=="admin"


def test_member_with_unattached_identity_can_edit_only_own_safe_profile(client,db):
    first,second,user,owner,member,_,locations=fixture(db,False)
    user.company_id=None;db.commit();headers=switch(client,user,second)
    changed=client.patch(f"/api/v1/users/{user.id}",headers=headers,json={"full_name":"Nombre actualizado"})
    assert changed.status_code==200,changed.text
    assert changed.json()["full_name"]=="Nombre actualizado"
    assert changed.json()["company_id"]==second.id and changed.json()["role"]["name"]=="viewer"
    assert changed.json()["can_manage_finance"] is False and changed.json()["is_initial_worker"] is True
    for payload in ({"role_id":1},{"company_id":second.id},{"is_active":False}):
        assert client.patch(f"/api/v1/users/{user.id}",headers=headers,json=payload).status_code==403
    assert client.patch(f"/api/v1/users/{owner.id}",headers=headers,json={"full_name":"No permitido"}).status_code==403
    db.refresh(user);assert user.company_id is None and user.role.name=="admin"


def test_external_identity_cannot_select_company_or_turn_a_grant_into_internal_context(client,db):
    from tests.test_client_portal_api import _portal_user,_client,_grant
    first,second,user,owner,member,_,locations=fixture(db)
    customer=_client(db,company=second,suffix="context-customer")
    person,headers=_portal_user(db,email="context-external@example.com",suffix="context-external")
    _grant(db,company=second,customer=customer,user=person,admin=owner);db.commit()
    for path in ("/api/v1/session/companies",):
        assert client.get(path,headers=headers).status_code==403
    assert client.post("/api/v1/session/company",headers=headers,json={"company_id":second.id}).status_code==403
    token=create_access_token({"sub":person.email,"ver":person.session_version,"company_id":second.id})
    assert client.get("/api/v1/users/me",headers={"Authorization":"Bearer "+token}).status_code==403
    assert client.get("/api/v1/client-portal/workspaces",headers=headers).status_code==200


def test_membership_epoch_revokes_only_changed_company_sessions_and_never_revives_them(client,db):
    first,second,user,owner,member,_,locations=fixture(db)
    primary=_headers(user);old=switch(client,user,second)
    global_version=user.session_version
    for state in ("suspended","active"):
        changed=client.patch(f"/api/v1/organization/members/{member.id}",headers=_headers(owner),json={"status":state})
        assert changed.status_code==200,changed.text
        assert client.get("/api/v1/users/me",headers=primary).status_code==200
    assert client.get("/api/v1/users/me",headers=old).status_code==401
    assert client.get("/api/v1/users/me",headers=primary).status_code==200
    db.refresh(user);db.refresh(member)
    assert user.session_version==global_version and member.session_version>=2
    new=switch(client,user,second)
    assert client.get("/api/v1/users/me",headers=new).status_code==200
    payload=jwt.decode(new["Authorization"].split()[1],settings.SECRET_KEY,algorithms=[settings.ALGORITHM])
    assert payload["membership_version"]==member.session_version
    for value in (True,-1,"1"):
        token=create_access_token({"sub":user.email,"ver":global_version,"company_id":second.id,"membership_version":value})
        assert client.get("/api/v1/users/me",headers={"Authorization":"Bearer "+token}).status_code==401
