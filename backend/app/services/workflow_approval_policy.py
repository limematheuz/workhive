"""Approval invariants shared by all purchase and task-completion paths."""
import hashlib,json
from datetime import datetime,timezone
from decimal import Decimal
from fastapi import HTTPException
from app.models.workflow_approval import TaskCloseApproval
from app.repositories import workflow_approval as repo


def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()


def purchase_digest(payload):return digest(payload.model_dump(mode="json"))


def requires(db,company,kind):
    policy=repo.policy(db,company)
    return bool(policy and getattr(policy,kind))


def require_purchase(db,user,payload,approval_id):
    if not requires(db,user.company_id,"purchases_required"):return
    approval=repo.proposal(db,user.company_id,approval_id) if approval_id is not None else None
    if approval is None or approval.status!="approved" or approval.purchase_id is not None or approval.fingerprint!=purchase_digest(payload):
        raise HTTPException(409,"Esta empresa requiere una solicitud de compra aprobada. Envía el borrador a aprobación antes de registrar gastos o existencias.")


def instant(value):
    if value is None:return None
    return (value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def number(value):return None if value is None else format(Decimal(str(value)).normalize(),"f")


def ordered(rows):return sorted(rows,key=lambda row:json.dumps(row,sort_keys=True,default=str))


def task_fingerprint(db,task):
    sessions=repo.sessions(db,task.id)
    return digest(dict(version=2,task=task.id,title=task.title,location=task.location_id,user_id=task.user_id,
        scheduled=instant(task.scheduled_start_at),due=instant(task.due_at),description=task.description,evidence=task.checklist_evidence,
        assignments=ordered((row.user_id,row.source or "checklist",row.status or "pending") for row in task.assignments),
        checklist=[(i.id,i.text,bool(i.completed),ordered((row.user_id,row.status or "pending") for row in i.assignments)) for i in sorted(task.checklist_items,key=lambda item:item.id or 0) if i not in db.deleted],
        price=number(task.price),quantity=number(task.quantity) if task.pricing_mode!="hourly" else None,pricing_mode=task.pricing_mode,unit=task.unit,
        sessions=ordered((s.user_id,instant(s.start_time),instant(s.end_time),int(s.paused_seconds or 0),instant(s.paused_at),
            ordered((instant(p.started_at),instant(p.ended_at)) for p in s.pauses if p not in db.deleted)) for s in sessions)))


def queue_closure(db,task,actor=None):
    fingerprint=task_fingerprint(db,task)
    row=repo.closure(db,task.company_id,task.id)
    if row is None:
        row=TaskCloseApproval(task_id=task.id,company_id=task.company_id,fingerprint=fingerprint,status="pending",requested_by=actor)
        db.add(row)
    elif row.fingerprint!=fingerprint or (actor is not None and row.status=="rejected"):
        row.fingerprint=fingerprint;row.status="pending";row.reviewed_by=None;row.reviewed_at=None;row.note="";row.requested_at=datetime.now(timezone.utc)
    if actor is not None:row.requested_by=actor
    return row


def defer_completion(db,task):
    if not requires(db,task.company_id,"task_close_required"):return False
    row=queue_closure(db,task)
    if row.status=="approved":return False
    task.status="review";task.date_done=None
    return True


def normalize_update(db,task,payload):
    if payload.status=="completed" and requires(db,task.company_id,"task_close_required"):
        row=repo.closure(db,task.company_id,task.id)
        if row is None or row.status!="approved" or row.fingerprint!=task_fingerprint(db,task):
            return payload.model_copy(update={"status":"review","date_done":None})
    return payload


def enforce_current_approval(db,task,*,reopened=False):
    if task.is_invoiced or not requires(db,task.company_id,"task_close_required"):return
    row=repo.closure(db,task.company_id,task.id)
    if row is None and task.status!="completed":return
    current=task_fingerprint(db,task)
    if row is not None and row.status=="approved" and (reopened or row.fingerprint!=current):
        row.status="pending";row.fingerprint=current;row.reviewed_by=None;row.reviewed_at=None
    if task.status=="completed" and (row is None or row.status!="approved" or row.fingerprint!=current):
        from app.services.task_billing_service import clear_work_snapshot_on_reopen
        queue_closure(db,task);task.status="review";task.date_done=None;clear_work_snapshot_on_reopen(task)
