from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.offline_work import OfflineWork
from app.models.work_session import WorkSession
from app.models.task_report import TaskReport
from app.repositories import offline_work as repo
from app.services import task_assignment_service, task_structure_service, task_billing_service
from app.services.labor_cost_snapshot_service import refresh_work_session_labor_cost
from app.services.organization_authorization_service import require_capability, permitted_location_ids
from app.services.user_scope import require_company_context


def utc(value):
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def serialize(row):
    return dict(id=row.id,event_id=row.event_id,task_id=row.task_id,user_id=row.user_id,
                starts_at=utc(row.starts_at),ends_at=utc(row.ends_at),paused_seconds=row.paused_seconds,
                checklist_ids=row.checklist_ids,description=row.description,status=row.status)


def register(db, user, payload):
    if payload.expected_user_id is not None and payload.expected_user_id != user.id:
        raise HTTPException(403, "La cuenta ha cambiado. Vuelve a entrar con la cuenta que guardó este parte.")
    company = require_company_context(user)
    if payload.expected_company_id is not None and payload.expected_company_id != company:
        raise HTTPException(403, "La empresa activa ha cambiado. Vuelve al espacio que guardó este parte.")
    existing = repo.by_event(db,user.id,str(payload.event_id))
    if existing:
        if existing.company_id != company:
            raise HTTPException(404, "Parte no encontrado")
        if existing.task_id != payload.task_id or utc(existing.starts_at) != payload.starts_at or utc(existing.ends_at) != payload.ends_at:
            raise HTTPException(409,"El identificador del parte ya pertenece a otro registro.")
        return serialize(existing)
    task = repo.task(db,company,payload.task_id)
    if not task:
        raise HTTPException(404,"Trabajo no encontrado")
    require_capability(db,user,"time.manage",scope_type="location",scope_id=task.location_id)
    if not task_assignment_service.is_user_assigned(task,user.id):
        raise HTTPException(403,"Solo puedes enviar partes de tus trabajos asignados.")
    owned = {i.id for i in task.checklist_items if any(a.user_id==user.id for a in i.assignments) or not i.assignments}
    if not set(payload.checklist_ids)<=owned:
        raise HTTPException(403,"El parte contiene tareas asignadas a otra persona.")
    if task.is_invoiced:
        raise HTTPException(409,"El trabajo ya está facturado.")
    repo.lock_user(db,user.id)
    existing = repo.by_event(db,user.id,str(payload.event_id))
    if existing:
        if existing.company_id != company:
            raise HTTPException(404, "Parte no encontrado")
        if existing.task_id != payload.task_id or utc(existing.starts_at) != payload.starts_at or utc(existing.ends_at) != payload.ends_at:
            raise HTTPException(409,"El identificador del parte ya pertenece a otro registro.")
        return serialize(existing)
    row = OfflineWork(company_id=company,user_id=user.id,**payload.model_dump(exclude={"event_id", "expected_user_id", "expected_company_id"}),event_id=str(payload.event_id))
    db.add(row);db.commit()
    return serialize(row)


def list_reports(db,user,review):
    company = require_company_context(user)
    if review:
        locations = permitted_location_ids(db,user,"time.approve")
        rows = repo.rows(db,company,locations)
    else:
        rows = repo.rows(db,company,user_id=user.id)
    return [serialize(row) for row in rows.order_by(OfflineWork.id.desc()).all()]


def review_report(db,user,report_id,payload):
    company = require_company_context(user)
    locations = permitted_location_ids(db,user,"time.approve")
    row = repo.rows(db,company,locations).filter(OfflineWork.id==report_id).with_for_update().first()
    if not row:
        raise HTTPException(404,"Parte no encontrado")
    if row.status != "pending":
        if row.status == payload.decision:
            return serialize(row)
        raise HTTPException(409,"El parte ya fue revisado.")
    task = repo.task(db,company,row.task_id)
    if payload.decision == "approved":
        require_capability(db,user,"work.manage",scope_type="location",scope_id=task.location_id)
        owned={item.id for item in task.checklist_items if not item.assignments or any(a.user_id==row.user_id for a in item.assignments)}
        if not task_assignment_service.is_user_assigned(task,row.user_id) or not set(row.checklist_ids)<=owned:
            raise HTTPException(409,"La asignación o el checklist del trabajo ha cambiado. Revisa el parte antes de aprobar.")
        repo.lock_user(db,row.user_id)
        if task.is_invoiced or repo.overlaps(db,row.user_id,row.starts_at,row.ends_at):
            raise HTTPException(409,"Revisa el trabajo facturado o los fichajes solapados antes de aprobar.")
        session = WorkSession(company_id=company,user_id=row.user_id,location_id=task.location_id,task_item_id=task.id,
                              start_time=row.starts_at,end_time=row.ends_at,paused_seconds=row.paused_seconds,
                              notes="Parte sin conexión aprobado")
        task_billing_service.lock_task_pricing(task)
        db.add(session);db.flush()
        refresh_work_session_labor_cost(db,work_session=session,company_id=company)
        row.session_id = session.id
        for item in task.checklist_items:
            if item.id in row.checklist_ids:
                task_structure_service.update_checklist_item(db,task,item,user,True,"yes",commit=False)
        reporter = repo.lock_user(db,row.user_id)
        db.add(TaskReport(task_item_id=task.id,reporter_user_id=row.user_id,reporter_company_id=company,
                          client_event_id=row.event_id,report_type="note",description=row.description,
                          reporter_name=reporter.full_name or reporter.email))
        if task.status in {"pending","accepted"}:
            task.status = "progress"
    row.status,row.reviewed_by,row.reviewed_at = payload.decision,user.id,datetime.now(timezone.utc)
    db.commit()
    return serialize(row)
