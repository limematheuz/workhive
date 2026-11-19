"""Assign a whole job to real employees without creating master spaces."""
from datetime import timedelta
from fastapi import HTTPException
from app.models.workforce_plan import TaskSpaceStaff,StaffChecklistProgress
from app.models.staff_shift import StaffShift
from app.models.task_structure import TaskAssignment,TaskChecklistAssignment
from app.repositories import workforce_plan as repo,staff_absence as absence_repo,staff_shift as shift_repo
from app.services import staff_shift_service as planning
from app.services.entitlement_service import require_company_feature

def apply(db,user,task,employee_ids,crew_id,minutes):
    if not employee_ids and crew_id is None:return
    company=task.company_id;require_company_feature(db,company_id=company,code="features.hr")
    people={person.id:person for person in repo.people(db,company)}
    absence_repo.lock_people(db,company,list(people))
    if crew_id is not None:
        if not any(crew.id==crew_id and crew.is_active for crew in repo.crews(db,company)):raise HTTPException(422,"Selecciona un equipo activo de tu empresa.")
        employee_ids=[row.employee_id for row in repo.members(db,{crew_id})]
        if not employee_ids:raise HTTPException(422,"El equipo no tiene trabajadores.")
    if not set(employee_ids)<=people.keys() or any((people[id].profile or {}).get("state")=="Baja" for id in employee_ids):raise HTTPException(422,"Selecciona trabajadores activos de tu empresa.")
    absences=shift_repo.absences(db,company);zone=planning.company_zone(db,company);effective=[]
    for id in employee_ids:
        ghost=StaffShift(employee_id=id,starts_at=task.scheduled_start_at,ends_at=task.scheduled_start_at+timedelta(minutes=minutes))
        replacement=planning.effective_person(ghost,absences,zone)
        if replacement is None:raise HTTPException(409,"Hay una ausencia sin cobertura para este horario.")
        if replacement not in people or (people[replacement].profile or {}).get("state")=="Baja":raise HTTPException(409,"La sustitución no está disponible.")
        if replacement in effective:raise HTTPException(409,"La cobertura duplica un puesto. Revisa el equipo.")
        effective.append(replacement)
    accounts={row.employee_id:row.user_id for row in repo.accounts(db,company,effective)}
    for id in effective:
        row=TaskSpaceStaff(company_id=company,task_id=task.id,space_id=None,space_name="Trabajo general",employee_id=id,crew_id=crew_id,planned_minutes=minutes);db.add(row);db.flush()
        account=accounts.get(id)
        if account is not None and not any(item.user_id==account for item in task.assignments):task.assignments.append(TaskAssignment(user_id=account,source="checklist",status="pending"))
        for item in task.checklist_items:
            db.add(StaffChecklistProgress(allocation_id=row.id,checklist_id=item.id,completed=False))
            if account is not None and not any(assignment.user_id==account for assignment in item.assignments):item.assignments.append(TaskChecklistAssignment(user_id=account,status="pending"))
        db.add(StaffShift(company_id=company,employee_id=id,location_id=task.location_id,task_id=task.id,starts_at=task.scheduled_start_at,ends_at=task.scheduled_start_at+timedelta(minutes=minutes)))
    db.flush();planning.validate_coverage(db,company)
