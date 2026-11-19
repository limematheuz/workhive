from fastapi import HTTPException
from app.models.workforce_plan import WorkOrderScope
from app.repositories import workforce_plan as repo
from app.schemas.workforce_plan import SpaceAllocation
from app.services import work_order_service,space_workforce_policy,task_item_service,location_access_service
from app.services.user_scope import require_company_context
from app.services import estimator_quote_service,contract_space_planning_policy


def generation_scope(db,company,order):
    row=repo.scope(db,company,order)
    if row is None:return {}
    try:
        if not isinstance(row.spaces,list) or not 1<=len(row.spaces)<=100:raise ValueError("Alcance no válido")
        selections=[SpaceAllocation.model_validate(item) for item in row.spaces]
        if len({item.space_id for item in selections})!=len(selections) or sum(len(item.task_ids) for item in selections)>200 or any(not item.task_ids for item in selections):raise ValueError("Revisa las tareas del alcance")
    except (TypeError,ValueError):
        raise HTTPException(422,"Revisa los espacios de la programación: cada ejecución necesita tareas y admite hasta 100 espacios y 200 tareas.")
    work_order=repo.order(db,company,order)
    pricing=estimator_quote_service.pricing_for_order(db,work_order,row.spaces)
    if pricing:contract_space_planning_policy.require_capacity(db,work_order)
    return dict(space_ids=[item.space_id for item in selections],space_task_template_ids=[id for item in selections for id in item.task_ids],space_allocations=selections,**pricing)


def choices(db,user,location):
    company=require_company_context(user)
    location_access_service.require_location_capability(db,user,location,"can_manage_tasks",permission_code="work.manage")
    people=repo.people(db,company).all();crews=repo.crews(db,company).filter_by(is_active=True).all();members=repo.members(db,[c.id for c in crews])
    return dict(people=[dict(id=p.id,name=p.name,position=p.position,state=(p.profile or {}).get("state","Activo")) for p in people],
        crews=[dict(id=c.id,name=c.name,employee_ids=[m.employee_id for m in members if m.crew_id==c.id]) for c in crews])


def create(db,user,payload):
    company=require_company_context(user)
    data=payload.work_order
    if payload.execution_count is not None:
        if data.order_type!="recurring" and payload.execution_count!=1:raise HTTPException(422,"Para varias visitas selecciona un servicio recurrente.")
        if data.order_type=="recurring":
            from app.services.work_order_calendar import next_occurrence
            last=data.scheduled_start_at
            for _ in range(payload.execution_count-1):last=next_occurrence(last,data.recurrence_unit,data.recurrence_interval)
            data=data.model_copy(update={"recurrence_ends_at":last})
    try:
        order=work_order_service.create_work_order(db,user,data,commit=False)
        resolved=space_workforce_policy.resolve(db,company,order.location_id,payload.spaces)
        if payload.generate_first and any(not data["tasks"] for data in resolved):raise HTTPException(422,"Selecciona al menos una tarea en cada espacio antes de generar el trabajo.")
        db.add(WorkOrderScope(work_order_id=order.id,company_id=company,spaces=[item.model_dump(mode="json") for item in payload.spaces]));db.flush()
        task=None
        if payload.generate_first:order,task=work_order_service.generate_next_task(db,user,order.id,commit=False)
        db.commit()
    except Exception:
        db.rollback();raise
    if task is not None:task_item_service.publish_created_task(db,task)
    return dict(work_order=order,task_id=task.id if task else None,space_count=len(payload.spaces))


def read_scope(db,user,order_id):
    order=work_order_service.get_work_order(db,user,order_id)
    scope=repo.scope(db,order.company_id,order.id)
    return scope.spaces if scope else []


def save_scope(db,user,order_id,selections):
    order=work_order_service.get_work_order(db,user,order_id)
    location_access_service.require_location_capability(db,user,order.location_id,"can_manage_tasks",permission_code="work.manage")
    if order.status not in {"active","draft","paused"}:raise HTTPException(409,"La programación ya está cerrada. Crea un nuevo trabajo para ampliar su alcance.")
    if not 1<=len(selections)<=100 or sum(len(item.task_ids) for item in selections)>200:raise HTTPException(422,"Cada ejecución admite de 1 a 100 espacios y hasta 200 tareas. Divide el servicio en varios trabajos.")
    space_workforce_policy.resolve(db,order.company_id,order.location_id,selections)
    row=repo.scope(db,order.company_id,order.id)
    before=row.spaces if row else []
    if row is None:row=WorkOrderScope(company_id=order.company_id,work_order_id=order.id);db.add(row)
    row.spaces=[item.model_dump(mode="json") for item in selections]
    from app.services.workforce_scope_history import record
    record(db,user,"work_order",order.id,order.location_id,before,row.spaces)
    db.commit()
    return row.spaces


def contract_scope(db,user,contract_id,location_id):
    company=require_company_context(user)
    location_access_service.require_location_capability(db,user,location_id,"can_manage_tasks",permission_code="work.manage")
    return contract_space_planning_policy.read_scope(db,company,contract_id,location_id)
