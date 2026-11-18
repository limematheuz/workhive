from copy import deepcopy
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import pytest
from fastapi import HTTPException
from app.models.expense import Expense
from app.models.inventory import InventoryMovement
from app.models.inventory_purchase import InventoryPurchase
from app.models.internal_request import InternalRequest
from app.models.staff_employee import StaffEmployee
from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistItem,TaskAssignment
from app.models.work_session import WorkSession
from app.models.workflow_approval import PurchaseApproval,PurchaseBudgetLink,TaskCloseApproval
from app.schemas.inventory_purchase import InventoryPurchaseCreate
from app.services import inventory_purchase_service,organization_bootstrap_service
from tests.test_inventory_purchase_flow import _inventory_company,_catalogue,_purchase_payload
from tests.test_location_workspace import _admin,_headers
from tests.test_task_structure import _location
from tests.test_accounting_periods import close


def purchase_setup(client,db,suffix):
    company=_inventory_company(db,suffix);owner=_admin(db,company);organization_bootstrap_service.ensure_user_membership(db,owner);db.commit();headers=_headers(owner)
    supplier,material,warehouse=_catalogue(client,headers)
    setting=client.put("/api/v1/workflow-approvals/policy",headers=headers,json={"purchases_required":True,"task_close_required":True})
    assert setting.status_code==200,setting.text
    return company,owner,headers,_purchase_payload(supplier["id"],material["id"],warehouse["id"])


def budget(client,db,company,owner,headers,amount):
    person=StaffEmployee(company_id=company.id,name="Solicitante",position="Administración",team="",monthly_hours=160,hourly_cost=15)
    db.add(person);db.commit()
    created=client.post("/api/v1/internal-requests",headers=headers,json={"employee_id":person.id,"kind":"purchase","description":"Presupuesto aprobado","starts_on":"2026-09-01","ends_on":"2026-09-01","amount":amount})
    assert created.status_code==201,created.text
    id=created.json()["id"]
    approved=client.post(f"/api/v1/internal-requests/{id}/review",headers=headers,json={"decision":"approved"})
    assert approved.status_code==200,approved.text
    return id


def proposal(client,headers,payload,request=None):
    response=client.post("/api/v1/workflow-approvals/purchases",headers=headers,json={"purchase":payload,"source_request_id":request})
    assert response.status_code==201,response.text
    return response.json()


def decide(client,headers,row):
    return client.post(f"/api/v1/workflow-approvals/purchases/{row['id']}/decision",headers=headers,json={"decision":"approved","fingerprint":row["fingerprint"]})


def test_budget_compares_gross_total_and_cannot_be_consumed_twice(client,db):
    company,owner,headers,payload=purchase_setup(client,db,"budget-gross")
    source=budget(client,db,company,owner,headers,"15.00")
    denied=client.post("/api/v1/workflow-approvals/purchases",headers=headers,json={"purchase":payload,"source_request_id":source})
    assert denied.status_code==409,denied.text
    assert db.query(PurchaseApproval).count()==db.query(Expense).count()==db.query(InventoryMovement).count()==0
    db.get(InternalRequest,source).amount=Decimal("15.13");db.commit()
    row=proposal(client,headers,payload,source)
    assert db.query(Expense).count()==0 and db.query(InventoryPurchase).count()==0
    duplicate=client.post("/api/v1/workflow-approvals/purchases",headers=headers,json={"purchase":payload,"source_request_id":source})
    assert duplicate.status_code==409,duplicate.text
    approved=decide(client,headers,row);assert approved.status_code==200,approved.text
    again=decide(client,headers,row);assert again.status_code==200,again.text
    assert again.json()["purchase_id"]==approved.json()["purchase_id"]
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==db.query(InventoryMovement).count()==1
    forged=client.post("/api/v1/inventory/purchases/",headers=headers,json={**payload,"approval_id":row["id"]})
    assert forged.status_code==409,forged.text
    assert db.query(Expense).count()==1


def test_reduced_budget_or_foreign_source_denies_before_creating_financial_records(client,db):
    company,owner,headers,payload=purchase_setup(client,db,"budget-live")
    source=budget(client,db,company,owner,headers,"20")
    row=proposal(client,headers,payload,source)
    db.get(InternalRequest,source).amount=Decimal("14");db.commit()
    denied=decide(client,headers,row);assert denied.status_code==409,denied.text
    current=db.get(PurchaseApproval,row["id"])
    assert current.status=="pending" and current.purchase_id is None and current.reviewed_by is None
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==db.query(InventoryMovement).count()==0
    other=_headers(_admin(db,_inventory_company(db,"budget-source-other")))
    denied=client.post("/api/v1/workflow-approvals/purchases",headers=other,json={"purchase":payload,"source_request_id":source})
    assert denied.status_code==404,denied.text


def test_closed_period_rolls_back_approval_expense_purchase_and_stock_atomically(client,db):
    company,owner,headers,payload=purchase_setup(client,db,"budget-closed")
    source=budget(client,db,company,owner,headers,"20")
    row=proposal(client,headers,payload,source)
    close(client,headers,company.id,month="2026-09")
    denied=decide(client,headers,row)
    assert denied.status_code==409,denied.text
    current=db.get(PurchaseApproval,row["id"])
    assert current.status=="pending" and current.purchase_id is None and current.reviewed_by is None
    assert db.query(PurchaseBudgetLink).filter_by(approval_id=row["id"],request_id=source).count()==1
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==db.query(InventoryMovement).count()==0


def test_internal_approved_purchase_reference_must_match_snapshot(client,db):
    company,owner,headers,payload=purchase_setup(client,db,"budget-fingerprint")
    row=proposal(client,headers,payload)
    stored=db.get(PurchaseApproval,row["id"]);stored.status="approved";db.commit()
    modified=deepcopy(payload);modified["reference"]="ALBARAN-DISTINTO"
    with pytest.raises(HTTPException) as error:
        inventory_purchase_service.create_purchase(db,owner,InventoryPurchaseCreate.model_validate(modified),approval_id=stored.id,commit=False)
    assert error.value.status_code==409
    db.rollback()
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==db.query(InventoryMovement).count()==0


def task_setup(client,db,suffix):
    company=_inventory_company(db,suffix);owner=_admin(db,company);organization_bootstrap_service.ensure_user_membership(db,owner);db.commit();headers=_headers(owner);site=_location(db,company)
    setting=client.put("/api/v1/workflow-approvals/policy",headers=headers,json={"purchases_required":False,"task_close_required":True})
    assert setting.status_code==200,setting.text
    task=TaskItem(company_id=company.id,location_id=site.id,title="Cierre controlado",description="Servicio original",status="accepted",unit="service",price=20,quantity=1)
    db.add(task);db.flush();item=TaskChecklistItem(task_id=task.id,text="Suelo",position=0,completed=False);db.add(item);db.commit()
    response=client.patch(f"/api/v1/task-items/{task.id}/checklist-items/{item.id}",headers=headers,json={"completed":True,"answer":"yes"})
    assert response.status_code==200,response.text
    endpoint=f"/api/v1/workflow-approvals/tasks/{task.id}"
    pending=client.get(endpoint,headers=headers).json()
    return company,owner,headers,task,item,endpoint,pending


def approve_task(client,headers,endpoint,pending):
    response=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":pending["fingerprint"]})
    assert response.status_code==200,response.text
    return response.json()


def test_changed_content_cannot_keep_completed_with_old_approval(client,db):
    _,_,headers,task,_,endpoint,pending=task_setup(client,db,"closure-change")
    approve_task(client,headers,endpoint,pending)
    changed=client.patch(f"/api/v1/task-items/{task.id}",headers=headers,json={"status":"completed","description":"Alcance modificado después de revisar"})
    assert changed.status_code==200,changed.text
    db.refresh(task)
    assert task.status=="review" and task.date_done is None
    current=client.get(endpoint,headers=headers).json()
    assert current["status"]=="pending"
    denied=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":pending["fingerprint"]})
    assert denied.status_code==409,denied.text


def test_unchecking_approved_work_invalidates_closure_and_direct_completed_patch_cannot_bypass(client,db):
    _,_,headers,task,item,endpoint,pending=task_setup(client,db,"closure-checklist")
    approve_task(client,headers,endpoint,pending)
    changed=client.patch(f"/api/v1/task-items/{task.id}/checklist-items/{item.id}",headers=headers,json={"completed":False,"answer":None})
    assert changed.status_code==200,changed.text
    db.refresh(task);db.refresh(item)
    assert task.status!="completed" and task.date_done is None and item.completed is False
    bypass=client.patch(f"/api/v1/task-items/{task.id}",headers=headers,json={"status":"completed"})
    assert bypass.status_code==409,bypass.text
    db.refresh(task);assert task.status!="completed"


def test_active_sessions_block_closure_and_reloaded_utc_session_fingerprint_remains_valid(client,db):
    _,owner,headers,task,_,endpoint,_=task_setup(client,db,"closure-session")
    start=datetime(2026,11,17,8,tzinfo=timezone.utc)
    session=WorkSession(user_id=owner.id,task_item_id=task.id,location_id=task.location_id,start_time=start)
    db.add(session);db.commit()
    queued=client.post(endpoint+"/request",headers=headers)
    assert queued.status_code==200,queued.text
    row=queued.json();assert row["can_decide"] is False
    denied=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":row["fingerprint"]})
    assert denied.status_code==409,denied.text
    db.refresh(session);session.end_time=start+timedelta(hours=1);session.paused_seconds=300;db.commit()
    queued=client.post(endpoint+"/request",headers=headers);assert queued.status_code==200,queued.text
    row=queued.json();db.expire_all()
    reloaded=client.get(endpoint,headers=headers).json()
    assert reloaded["current_fingerprint"]==row["fingerprint"]
    approved=approve_task(client,headers,endpoint,row)
    db.refresh(task);assert task.status=="completed" and approved["status"]=="approved"


def test_assignee_change_after_approval_requires_review_and_cross_tenant_assignee_denied(client,db):
    from tests.test_client_permission_authorization import _user
    company,_,headers,task,_,endpoint,pending=task_setup(client,db,"closure-assignee")
    employee=_user(db,company,"closure-next-worker",role_id=3);db.commit()
    approve_task(client,headers,endpoint,pending)
    changed=client.patch(f"/api/v1/task-items/{task.id}",headers=headers,json={"status":"completed","user_id":employee.id})
    assert changed.status_code==200,changed.text
    db.refresh(task)
    assert task.user_id==employee.id and task.status=="review" and task.date_done is None
    other=_user(db,_inventory_company(db,"closure-assignee-other"),"closure-foreign-worker",role_id=3);db.commit()
    denied=client.patch(f"/api/v1/task-items/{task.id}",headers=headers,json={"status":"completed","user_id":other.id})
    assert denied.status_code==400,denied.text
    db.refresh(task);assert task.user_id==employee.id and task.status!="completed"


def test_paused_seconds_are_part_of_the_reviewed_session_fingerprint(client,db):
    _,owner,headers,task,_,endpoint,_=task_setup(client,db,"closure-pauses")
    start=datetime(2026,11,17,8,tzinfo=timezone.utc)
    session=WorkSession(user_id=owner.id,task_item_id=task.id,location_id=task.location_id,start_time=start,end_time=start+timedelta(hours=1),paused_seconds=0)
    db.add(session);db.commit()
    queued=client.post(endpoint+"/request",headers=headers)
    assert queued.status_code==200,queued.text
    before=queued.json()["fingerprint"]
    session.paused_seconds=900;db.commit()
    after=client.get(endpoint,headers=headers).json()
    assert after["current_fingerprint"]!=before and after["can_decide"] is False
    denied=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":before})
    assert denied.status_code==409,denied.text


def test_worker_finishes_its_session_but_manager_remains_responsible_for_final_closure(client,db):
    from tests.test_client_permission_authorization import _user
    company=_inventory_company(db,"closure-worker");owner=_admin(db,company);headers=_headers(owner);site=_location(db,company)
    assert client.put("/api/v1/workflow-approvals/policy",headers=headers,json={"purchases_required":False,"task_close_required":True}).status_code==200
    worker=_user(db,company,"closure-real-worker",role_id=3)
    task=TaskItem(company_id=company.id,location_id=site.id,user_id=worker.id,title="Trabajo del empleado",status="accepted",unit="service",price=20,quantity=1)
    db.add(task);db.flush()
    item=TaskChecklistItem(task_id=task.id,text="Suelo",position=0,completed=False)
    db.add(item);db.add(TaskAssignment(task_id=task.id,user_id=worker.id,source="direct",status="accepted"));db.commit()
    own=_headers(worker)
    started=client.post(f"/api/v1/task-items/{task.id}/start-work",headers=own,json={"start_latitude":0,"start_longitude":0})
    assert started.status_code==200,started.text
    updated=client.patch(f"/api/v1/task-items/{task.id}/checklist-items/{item.id}",headers=own,json={"completed":True,"answer":"yes"})
    assert updated.status_code==200,updated.text
    endpoint=f"/api/v1/workflow-approvals/tasks/{task.id}"
    queued=client.get(endpoint,headers=headers).json()
    assert queued["status"]=="pending" and queued["can_decide"] is False
    finished=client.post(f"/api/v1/task-items/{task.id}/finish-work",headers=own)
    assert finished.status_code==200,finished.text
    db.refresh(task);assert task.status=="review" and task.date_done is None
    assert all(log.end_time is not None for log in db.query(WorkSession).filter_by(task_item_id=task.id))
    ready=client.get(endpoint,headers=headers).json()
    assert ready["can_decide"] is True,ready
    approve_task(client,headers,endpoint,ready)
    db.refresh(task);assert task.status=="completed"


def test_rejected_budget_proposal_releases_reservation_for_corrected_retry(client,db):
    company,owner,headers,payload=purchase_setup(client,db,"budget-retry")
    source=budget(client,db,company,owner,headers,"20")
    first=proposal(client,headers,payload,source)
    rejected=client.post(f"/api/v1/workflow-approvals/purchases/{first['id']}/decision",headers=headers,json={"decision":"rejected","fingerprint":first["fingerprint"],"note":"Revisar el albarán antes de recibir"})
    assert rejected.status_code==200,rejected.text
    first_link=db.get(PurchaseBudgetLink,first["id"])
    assert first_link.active_request_id is None
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==0
    corrected=deepcopy(payload);corrected["reference"]="ALBARAN-CORREGIDO"
    second=proposal(client,headers,corrected,source)
    assert second["id"]!=first["id"]
    approved=decide(client,headers,second);assert approved.status_code==200,approved.text
    resurrected=decide(client,headers,first)
    assert resurrected.status_code==409,resurrected.text
    assert db.query(Expense).count()==db.query(InventoryPurchase).count()==db.query(InventoryMovement).count()==1
    assert db.query(PurchaseBudgetLink).filter_by(request_id=source).count()==2
    assert db.query(PurchaseBudgetLink).filter_by(active_request_id=source).one().approval_id==second["id"]


def test_duplicate_session_times_with_open_and_closed_rows_have_safe_stable_fingerprint(client,db):
    _,owner,headers,task,_,endpoint,_=task_setup(client,db,"closure-duplicate-sessions")
    start=datetime(2026,11,17,8,tzinfo=timezone.utc)
    db.add_all([WorkSession(user_id=owner.id,task_item_id=task.id,location_id=task.location_id,start_time=start,end_time=None),
        WorkSession(user_id=owner.id,task_item_id=task.id,location_id=task.location_id,start_time=start,end_time=start+timedelta(hours=1))])
    db.commit()
    response=client.get(endpoint,headers=headers)
    assert response.status_code==200,response.text
    current=response.json()
    assert len(current["current_fingerprint"])==64 and current["can_decide"] is False
    queued=client.post(endpoint+"/request",headers=headers)
    assert queued.status_code==200,queued.text
    assert queued.json()["fingerprint"]==current["current_fingerprint"]
    denied=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":queued.json()["fingerprint"]})
    assert denied.status_code==409,denied.text
