from sqlalchemy.orm import selectinload
from app.models.internal_request import InternalRequest
from app.models.workflow_approval import OperationsApprovalPolicy,PurchaseApproval,TaskCloseApproval,PurchaseBudgetLink
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession


def policy(db,company):return db.query(OperationsApprovalPolicy).filter_by(company_id=company).first()


def proposals(db,company):return db.query(PurchaseApproval).options(selectinload(PurchaseApproval.budget_link).selectinload(PurchaseBudgetLink.request)).filter_by(company_id=company)


def proposal(db,company,id):return proposals(db,company).filter_by(id=id).with_for_update().first()


def task(db,company,id):return db.query(TaskItem).filter_by(company_id=company,id=id).with_for_update().first()


def closure(db,company,task):
    pending=next((row for row in db.new if isinstance(row,TaskCloseApproval) and row.company_id==company and row.task_id==task),None)
    return pending or db.query(TaskCloseApproval).filter_by(company_id=company,task_id=task).with_for_update().first()


def sessions(db,task):
    rows=db.query(WorkSession).options(selectinload(WorkSession.pauses)).filter_by(task_item_id=task).order_by(WorkSession.id).all()
    return [row for row in rows if row not in db.deleted]+[row for row in db.new if isinstance(row,WorkSession) and row.task_item_id==task]


def source_requests(db,company):return db.query(InternalRequest).options(selectinload(InternalRequest.purchase_links)).filter_by(company_id=company,kind="purchase",status="approved").order_by(InternalRequest.id.desc())


def source_request(db,company,id):return source_requests(db,company).filter(InternalRequest.id==id).with_for_update().first()


def affected_completed_tasks(db,task_ids,session_ids,pause_session_ids):
    ids=set(task_ids);references=set(session_ids)|set(pause_session_ids)
    if references:
        for (task,) in db.query(WorkSession.task_item_id).filter(WorkSession.id.in_(references)):
            if task is not None:ids.add(task)
    return db.query(TaskItem).filter(TaskItem.id.in_(ids),TaskItem.status=="completed").with_for_update().all() if ids else []
