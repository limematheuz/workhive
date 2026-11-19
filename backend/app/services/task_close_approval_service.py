"""A separate manager decision closes a completed execution when required."""
from datetime import datetime,timezone
from fastapi import HTTPException
from app.repositories import workflow_approval as repo
from app.services import workflow_approval_policy as policy,location_access_service,task_assignment_service,task_billing_service
from app.services import task_work_completion_service as completion
from app.services.workflow_approval_service import audit
from app.services.user_scope import require_company_context
from app.services.entitlement_service import require_company_feature,company_feature_enabled


def access(db,user,id):
    company=require_company_context(user);task=repo.task(db,company,id)
    if task is None:raise HTTPException(404,"Trabajo no encontrado")
    location_access_service.require_location_capability(db,user,task.location_id,"can_manage_tasks",permission_code="work.manage")
    return task


def read(db,user,id):
    task=access(db,user,id);row=repo.closure(db,task.company_id,task.id)
    complete=task_assignment_service.all_task_checklist_items_are_complete(task)
    active=any(session.end_time is None for session in repo.sessions(db,task.id))
    fingerprint=policy.task_fingerprint(db,task)
    stale=bool(row and row.fingerprint!=fingerprint)
    available=company_feature_enabled(db,company_id=task.company_id,code="features.approvals")
    return dict(available=available,can_request=available and complete and (task.status!="completed" or stale) and not task.is_invoiced,
        can_decide=bool(available and row and row.status=="pending" and not stale and not active and complete and not task.is_invoiced),
        required=policy.requires(db,task.company_id,"task_close_required"),task_id=task.id,
        status="outdated" if stale else row.status if row else "not_requested",fingerprint=row.fingerprint if row else None,
        current_fingerprint=fingerprint,note=row.note if row else "",reviewed_by=row.reviewed_by if row else None)


def request(db,user,id):
    task=access(db,user,id)
    policy.enforce_current_approval(db,task)
    require_company_feature(db,company_id=task.company_id,code="features.approvals")
    if task.is_invoiced or task.status=="completed":raise HTTPException(409,"El trabajo ya está cerrado.")
    if not task_assignment_service.all_task_checklist_items_are_complete(task):raise HTTPException(409,"Completa todos los requisitos antes de pedir el cierre.")
    policy.queue_closure(db,task,user.id);task.status="review";task.date_done=None
    audit(db,user,"work.close_requested","task_item",task.id,{})
    db.commit();return read(db,user,id)


def decide(db,user,id,payload):
    try:
        task=access(db,user,id);require_company_feature(db,company_id=task.company_id,code="features.approvals")
        row=repo.closure(db,task.company_id,task.id)
        if row is None:raise HTTPException(409,"No hay solicitud de cierre pendiente.")
        if task.is_invoiced:raise HTTPException(409,"El trabajo ya está facturado.")
        if row.fingerprint!=payload.fingerprint or row.fingerprint!=policy.task_fingerprint(db,task):raise HTTPException(409,"El trabajo ha cambiado. Solicita de nuevo su revisión.")
        if row.status!="pending":
            if row.status==payload.decision:return read(db,user,id)
            raise HTTPException(409,"La solicitud ya está resuelta.")
        if payload.decision=="approved":
            if not task_assignment_service.all_task_checklist_items_are_complete(task):raise HTTPException(409,"Hay requisitos pendientes.")
            if any(session.end_time is None for session in repo.sessions(db,task.id)):raise HTTPException(409,"Primero finaliza los fichajes activos de este trabajo.")
        elif not payload.note:raise HTTPException(422,"Indica qué debe corregirse.")
        row.status=payload.decision;row.reviewed_by=user.id;row.reviewed_at=datetime.now(timezone.utc);row.note=payload.note
        if row.status=="approved":completion.mark_task_completed(db,task)
        else:task.status="progress";task.date_done=None;task_billing_service.clear_work_snapshot_on_reopen(task)
        audit(db,user,"work.close_decided","task_item",task.id,{"decision":row.status,"note":row.note})
        db.commit();return read(db,user,id)
    except Exception:db.rollback();raise
