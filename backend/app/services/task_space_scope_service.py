"""Replace an execution's scope atomically before any work or billing activity."""
from datetime import timedelta
from fastapi import HTTPException
from app.models.audit_log import AuditLog
from app.repositories import workforce_plan, task_space_scope as repo, location_workspace, staff_absence
from app.schemas.location_workspace import LocationSpaceResponse
from app.schemas.workforce_plan import SpaceAllocation
from app.services import location_access_service, location_zone_service, location_workspace_service
from app.services import service_planning_service, space_workforce_policy, task_space_workforce_service
from app.services import estimator_quote_service
from app.services.staff_shift_service import utc
from app.services.task_structure_service import description_assignee_ids
from app.services.task_work_activity_service import has_recorded_activity
from app.services.task_work_completion_service import require_work_orders_feature
from app.services.user_scope import require_company_context


def _task(db, user, task_id):
    company = require_company_context(user)
    task = repo.task_record(db, company, task_id)
    if task is None:
        raise HTTPException(404, "Trabajo no encontrado")
    location_access_service.require_location_capability(db, user, task.location_id, "can_manage_tasks", permission_code="work.manage")
    return task


def _blocked(db, task, allocations):
    if task.is_invoiced or task.invoice_items:
        return "Este trabajo ya está vinculado a una factura. Su reparto no se puede sustituir."
    if task.status not in {"pending", "accepted", "requested", "rejected"} or has_recorded_activity(db, task):
        return "El trabajo ya tiene actividad. Conserva su historial y crea una ejecución adicional para ampliar el alcance."
    if any(row.completed or row.completed_by is not None or row.completed_at is not None or row.answer is not None for row in workforce_plan.progress(db, [allocation.id for allocation in allocations])):
        return "Ya se ha registrado progreso individual y el reparto está cerrado."
    return None


def _current(db, task, allocations):
    templates = repo.templates(db, [item.location_space_task_template_id for item in task.checklist_items if item.location_space_task_template_id is not None])
    by_space = {}
    for template in templates:
        by_space.setdefault(template.location_space_id, []).append(template.id)
    crew_ids = {row.crew_id for row in allocations if row.crew_id is not None}
    crews = {crew.id for crew in workforce_plan.crews(db, task.company_id).filter_by(is_active=True).all()}
    members = workforce_plan.members(db, crew_ids)
    selections = []
    for zone in task.zones:
        rows = [row for row in allocations if row.space_id == zone.zone_id]
        employees = sorted({row.employee_id for row in rows})
        crew = rows[0].crew_id if rows and all(row.crew_id == rows[0].crew_id for row in rows) else None
        if crew not in crews or set(employees) != {member.employee_id for member in members if member.crew_id == crew}:
            crew = None
        effort = min(sum(row.planned_minutes or 0 for row in rows), 100000) or None
        selections.append(SpaceAllocation(space_id=zone.zone_id, task_ids=by_space.get(zone.zone_id, []),
            crew_id=crew, employee_ids=[] if crew else employees, planned_minutes=effort))
    return selections


def read(db, user, task_id):
    task = _task(db, user, task_id)
    allocations = workforce_plan.allocations(db, task.company_id, [task.id]).all()
    reason = _blocked(db, task, allocations)
    return dict(task_id=task.id, location_id=task.location_id, scheduled_start_at=utc(task.scheduled_start_at) if task.scheduled_start_at else None,
        spaces=_current(db, task, allocations),
        available_spaces=[LocationSpaceResponse.model_validate(space) for space in location_workspace.list_spaces(db, task.location_id)],
        choices=service_planning_service.choices(db, user, task.location_id), can_edit=reason is None, blocked_reason=reason)


def _clear_generated(db, task, allocations):
    generated = [item for item in task.checklist_items if item.location_space_task_template_id is not None or item.space_name is not None]
    derived_users = {assignment.user_id for item in generated for assignment in item.assignments}
    derived_users.update(account.user_id for account in workforce_plan.accounts(db, task.company_id, [row.employee_id for row in allocations]))
    retained = [item for item in task.checklist_items if item not in generated]
    retained_users = {assignment.user_id for item in retained for assignment in item.assignments}
    retained_users.update(description_assignee_ids(task.description))
    retained_users.add(task.user_id)
    task.assignments[:] = [assignment for assignment in task.assignments
        if assignment.source != "checklist" or assignment.user_id not in derived_users or assignment.user_id in retained_users]
    if task.accepted_by_user_id in derived_users - retained_users:
        task.accepted_by_user_id = None
    minutes = {}
    for row in allocations:
        minutes[row.employee_id] = minutes.get(row.employee_id, 0) + (row.planned_minutes or 0)
    if task.due_at is not None and task.scheduled_start_at is not None and minutes and utc(task.due_at) == utc(task.scheduled_start_at) + timedelta(minutes=max(minutes.values())):
        task.due_at = None
    repo.clear_allocations(db, task.company_id, task, allocations)
    task.checklist_items[:] = retained
    task.zones.clear()
    db.flush()


def save(db, user, task_id, payload):
    try:
        task = _task(db, user, task_id)
        require_work_orders_feature(db, user)
        allocations = workforce_plan.allocations(db, task.company_id, [task.id]).all()
        reason = _blocked(db, task, allocations)
        if reason:
            raise HTTPException(409, reason)
        current = _current(db, task, allocations)
        if task.work_order is not None and task.work_order.service_contract_id is not None and estimator_quote_service.pricing_for_order(db, task.work_order, current):
            subject = lambda selections: sorted((item.space_id, tuple(sorted(item.task_ids))) for item in selections)
            if subject(current) != subject(payload.spaces):
                raise HTTPException(409, "El alcance está vinculado a un presupuesto aceptado. Revisa el acuerdo antes de cambiar espacios o tareas.")
        staff_absence.lock_people(db, task.company_id, [person.id for person in workforce_plan.people(db, task.company_id)])
        resolved = space_workforce_policy.resolve(db, task.company_id, task.location_id, payload.spaces)
        if any(not item["tasks"] for item in resolved):
            raise HTTPException(422, "Selecciona al menos una tarea en cada espacio del trabajo.")
        _clear_generated(db, task, allocations)
        location_zone_service.sync_task_zones(db, task.id, task.location_id, [item.space_id for item in payload.spaces])
        db.expire(task, ["zones"])
        templates = [template for item in resolved for template in item["tasks"]]
        location_workspace_service.append_selected_space_tasks_to_checklist(db, task, templates)
        task_space_workforce_service.apply(db, user, task, resolved)
        from app.services.workforce_scope_history import record
        record(db,user,"task_item",task.id,task.location_id,[row.model_dump(mode="json") for row in current],[row.model_dump(mode="json") for row in payload.spaces])
        db.commit()
    except Exception:
        db.rollback()
        raise
    return read(db, user, task_id)
