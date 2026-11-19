from app.models.audit_log import AuditLog
from app.models.workforce_plan import StaffChecklistProgress
from datetime import datetime,timezone
from fastapi import HTTPException
from app.repositories import workforce_plan as repo
from app.services.organization_authorization_service import has_capability,require_capability
from app.services.user_scope import require_company_context
from app.services import task_assignment_service,task_update_policy_service,task_billing_service
from app.repositories import work_session as work_session_repo


def access(db,user,task_id):
    company=require_company_context(user)
    task=repo.task_record(db,company,task_id)
    if task is None:raise HTTPException(404,"Trabajo no encontrado")
    require_capability(db,user,"work.read",scope_type="location",scope_id=task.location_id)
    manager=has_capability(db,user,"work.manage",scope_type="location",scope_id=task.location_id)
    own=repo.own_employee(db,company,user.id)
    allocations=repo.allocations(db,company,[task.id]).all()
    if not manager and not any(row.employee_id==own for row in allocations) and not task_assignment_service.is_user_assigned(task,user.id):raise HTTPException(403,"Solo puedes consultar tu trabajo asignado.")
    return task,manager,own,allocations


def read(db,user,task_id):
    task,manager,own,allocations=access(db,user,task_id)
    if not manager:allocations=[row for row in allocations if row.employee_id==own]
    can_edit=not task.is_invoiced and (manager or any(session.task_item_id==task.id for session in work_session_repo.get_active_sessions_by_user(db,user.id)))
    progress=repo.progress(db,[row.id for row in allocations]);items={item.id:item for item in repo.checklist(db,[row.checklist_id for row in progress])}
    people={person.id:person for person in repo.people(db,task.company_id,[row.employee_id for row in allocations])}
    return [dict(id=row.id,space_id=row.space_id,space_name=row.space_name,employee_id=row.employee_id,
        employee=people[row.employee_id].name,can_edit=can_edit,can_manage=manager,crew_id=row.crew_id,planned_minutes=row.planned_minutes,
        tasks=[dict(id=step.checklist_id,title=items[step.checklist_id].text,completed=step.completed,answer=step.answer) for step in progress if step.allocation_id==row.id],
        done=sum(step.completed for step in progress if step.allocation_id==row.id),total=sum(1 for step in progress if step.allocation_id==row.id)) for row in allocations]


def mark(db,user,task_id,allocation_id,checklist_id,completed,answer=None):
    task,manager,own,allocations=access(db,user,task_id)
    if task.is_invoiced:raise HTTPException(409,"El trabajo está facturado y su ejecución está cerrada.")
    allocation=next((row for row in allocations if row.id==allocation_id),None)
    if allocation is None:raise HTTPException(404,"Asignación no encontrada")
    if not manager and allocation.employee_id!=own:raise HTTPException(403,"Solo puedes completar tus tareas.")
    if not manager:
        require_capability(db,user,"time.manage",scope_type="location",scope_id=task.location_id)
        task_update_policy_service.require_active_task_session(db,task,user)
    rows=repo.task_progress(db,task.company_id,task.id).filter(StaffChecklistProgress.checklist_id==checklist_id).all()
    step=next((row for row,assignment in rows if assignment.id==allocation_id),None)
    if step is None:raise HTTPException(404,"Tarea del trabajador no encontrada")
    step.completed=completed;step.answer=(answer or "yes") if completed else None;step.completed_by=user.id;step.completed_at=datetime.now(timezone.utc) if completed else None
    item=repo.checklist(db,[checklist_id])[0]
    item.completed=all(row.completed for row,_ in rows)
    evidence=dict(task.checklist_evidence or {});key=f"item_{item.id}"
    evidence[key]={**evidence.get(key,{}),"answer":("no" if any(row.answer=="no" for row,_ in rows) else "yes") if item.completed else None}
    task.checklist_evidence=evidence
    accounts={account.employee_id:account.user_id for account in repo.accounts(db,task.company_id,[row.employee_id for row in allocations])}
    for assignment in item.assignments:
        relevant=[row for row,allocation in rows if accounts.get(allocation.employee_id)==assignment.user_id]
        if relevant:assignment.status="completed" if all(row.completed for row in relevant) else "pending"
    if task.status=="completed" and not item.completed:
        task.status="progress";task.date_done=None;task_billing_service.clear_work_snapshot_on_reopen(task)
    from app.services.task_work_completion_service import complete_task_when_checklist_is_done
    complete_task_when_checklist_is_done(db,task)
    db.add(AuditLog(company_id=task.company_id,actor_user_id=user.id,action="staff.checklist_updated",entity_type="task_item",entity_id=str(task.id),details={"allocation_id":allocation_id,"checklist_id":checklist_id,"completed":completed,"answer":step.answer}))
    db.commit()
    return read(db,user,task_id)


def from_account(db,task,item,user,completed,answer=None):
    rows=repo.task_progress(db,task.company_id,task.id).filter(StaffChecklistProgress.checklist_id==item.id).all()
    if not rows:return False
    manager=has_capability(db,user,"work.manage",scope_type="location",scope_id=task.location_id)
    own=repo.own_employee(db,task.company_id,user.id)
    permitted=[row for row,allocation in rows if manager or allocation.employee_id==own]
    if not permitted:raise HTTPException(403,"Esta tarea corresponde a otros trabajadores.")
    for row in permitted:
        row.completed=completed;row.answer=(answer or "yes") if completed else None;row.completed_by=user.id;row.completed_at=datetime.now(timezone.utc) if completed else None
    item.completed=all(row.completed for row,_ in rows)
    return ("no" if any(row.answer=="no" for row,_ in rows) else "yes") if item.completed else "pending"
