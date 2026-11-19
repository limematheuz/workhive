from app.models.expense import Expense
from app.models.inventory_purchase import InventoryPurchase
from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistItem
from app.models.workflow_approval import TaskCloseApproval
from tests.test_inventory_purchase_flow import _inventory_company,_catalogue,_purchase_payload
from tests.test_location_workspace import _admin,_headers
from tests.test_task_structure import _location


def test_purchase_approval_controls_real_expense_and_stock_once(client,db):
    company=_inventory_company(db,"approved-purchase");owner=_admin(db,company);headers=_headers(owner)
    supplier,material,warehouse=_catalogue(client,headers)
    policy=client.put("/api/v1/workflow-approvals/policy",headers=headers,json={"purchases_required":True,"task_close_required":False})
    assert policy.status_code==200,policy.text
    payload=_purchase_payload(supplier["id"],material["id"],warehouse["id"])
    denied=client.post("/api/v1/inventory/purchases/",headers=headers,json=payload)
    assert denied.status_code==409,denied.text
    assert db.query(Expense).count()==0 and db.query(InventoryPurchase).count()==0
    proposal=client.post("/api/v1/workflow-approvals/purchases",headers=headers,json={"purchase":payload})
    assert proposal.status_code==201,proposal.text
    row=proposal.json();endpoint=f"/api/v1/workflow-approvals/purchases/{row['id']}/decision"
    stale=client.post(endpoint,headers=headers,json={"decision":"approved","fingerprint":"0"*64})
    assert stale.status_code==409
    response=client.post(endpoint,headers=headers,json={"decision":"approved","fingerprint":row["fingerprint"]})
    assert response.status_code==200,response.text
    assert response.json()["purchase_id"] is not None and db.query(Expense).count()==1
    assert client.post(endpoint,headers=headers,json={"decision":"approved","fingerprint":row["fingerprint"]}).status_code==200
    assert db.query(Expense).count()==1 and db.query(InventoryPurchase).count()==1
    other=_headers(_admin(db,_inventory_company(db,"approval-foreign")))
    assert client.post(endpoint,headers=other,json={"decision":"approved","fingerprint":row["fingerprint"]}).status_code==404


def test_work_closure_waits_for_separate_decision_and_denies_stale_changes(client,db):
    company=_inventory_company(db,"approved-work");owner=_admin(db,company);headers=_headers(owner);location=_location(db,company)
    policy=client.put("/api/v1/workflow-approvals/policy",headers=headers,json={"purchases_required":False,"task_close_required":True})
    assert policy.status_code==200,policy.text
    task=TaskItem(company_id=company.id,location_id=location.id,title="Trabajo revisado",status="accepted",unit="service",price=20,quantity=1)
    db.add(task);db.flush();item=TaskChecklistItem(task_id=task.id,text="Suelo",position=0,completed=False);db.add(item);db.commit()
    updated=client.patch(f"/api/v1/task-items/{task.id}/checklist-items/{item.id}",headers=headers,json={"completed":True,"answer":"yes"})
    assert updated.status_code==200,updated.text
    db.refresh(task);assert task.status=="review" and task.date_done is None
    endpoint=f"/api/v1/workflow-approvals/tasks/{task.id}"
    request=client.get(endpoint,headers=headers);assert request.status_code==200,request.text
    row=request.json();assert row["status"]=="pending" and row["can_decide"] is True
    stale=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":"0"*64})
    assert stale.status_code==409
    result=client.post(endpoint+"/decision",headers=headers,json={"decision":"approved","fingerprint":row["fingerprint"]})
    assert result.status_code==200,result.text
    db.refresh(task);assert task.status=="completed" and task.date_done is not None
    assert db.get(TaskCloseApproval,task.id).reviewed_by==owner.id
