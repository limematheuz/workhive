from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.workflow_approval import ApprovalPolicyInput,PurchaseProposalInput,ApprovalDecision
from app.services import workflow_approval_service as service,task_close_approval_service as tasks
router=APIRouter(prefix="/workflow-approvals")


@router.get("/policy")
def settings(db:Session=Depends(get_db),user=ActiveUser):return service.settings(db,user)


@router.put("/policy")
def save_settings(payload:ApprovalPolicyInput,db:Session=Depends(get_db),user=ActiveUser):return service.save_settings(db,user,payload)


@router.get("/purchases")
def purchases(db:Session=Depends(get_db),user=ActiveUser):return service.list_purchases(db,user)


@router.post("/purchases",status_code=201)
def create_purchase(payload:PurchaseProposalInput,db:Session=Depends(get_db),user=ActiveUser):return service.submit_purchase(db,user,payload.purchase,payload.source_request_id)


@router.post("/purchases/{id}/decision")
def decide_purchase(id:int,payload:ApprovalDecision,db:Session=Depends(get_db),user=ActiveUser):return service.decide_purchase(db,user,id,payload)


@router.get("/tasks/{id}")
def task(id:int,db:Session=Depends(get_db),user=ActiveUser):return tasks.read(db,user,id)


@router.post("/tasks/{id}/request")
def request_task(id:int,db:Session=Depends(get_db),user=ActiveUser):return tasks.request(db,user,id)


@router.post("/tasks/{id}/decision")
def decide_task(id:int,payload:ApprovalDecision,db:Session=Depends(get_db),user=ActiveUser):return tasks.decide(db,user,id,payload)


@router.get("/source-requests")
def source_requests(db:Session=Depends(get_db),user=ActiveUser):return service.source_requests(db,user)
