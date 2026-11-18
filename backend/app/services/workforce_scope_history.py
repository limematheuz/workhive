"""Immutable operational before/after snapshots, separate from private costs."""
from app.models.audit_log import AuditLog
from app.repositories import workforce_plan as repo

def snapshot(db,company,location,selections):
    spaces={row.id:row.name for row in repo.spaces(db,location)};people={row.id:row.name for row in repo.people(db,company)};crews={row.id:row.name for row in repo.crews(db,company)}
    ids={id for row in selections for id in row.get("task_ids",[])};tasks={row.id:row.title for row in repo.templates(db,ids)}
    return "\n".join(f"{spaces.get(row['space_id'],'Espacio #'+str(row['space_id']))} · Tareas: "+", ".join(tasks.get(id,"Tarea #"+str(id)) for id in row.get("task_ids",[]))+" · Personal: "+(", ".join(people.get(id,"Trabajador #"+str(id)) for id in row.get("employee_ids",[])) or crews.get(row.get("crew_id"),"Sin asignar"))+" · Esfuerzo: "+str(row.get("planned_minutes") or "Sin estimar")+" min" for row in sorted(selections,key=lambda row:row['space_id'])) or "Sin espacios asignados"

def record(db,user,entity,id,location,before,after):
    if before==after:return
    db.add(AuditLog(company_id=user.company_id,actor_user_id=user.id,action="workforce.scope_changed",entity_type=entity,entity_id=str(id),details={"changes":[dict(field="workforce_scope",before=snapshot(db,user.company_id,location,before),after=snapshot(db,user.company_id,location,after),before_known=True)],"before_scope":before,"after_scope":after}))
