from datetime import datetime,timedelta,timezone
from math import ceil
from fastapi import HTTPException
from app.models.workforce_plan import TaskSpaceStaff,StaffChecklistProgress
from app.models.staff_shift import StaffShift
from app.models.task_structure import TaskAssignment,TaskChecklistAssignment
from app.repositories import workforce_plan as repo,staff_absence as absence_repo,staff_shift as shift_repo
from app.services import staff_shift_service as planning
from app.services.organization_authorization_service import require_capability


def apply(db,user,task,resolved):
    if not resolved:return
    if any(item["workers"] for item in resolved) and task.scheduled_start_at is None:raise HTTPException(422,"Indica el inicio del trabajo antes de asignar plantilla.")
    db.expire(task,["checklist_items"])
    company=task.company_id
    people=repo.people(db,company).all()
    active_people={p.id for p in people if (p.profile or {}).get("state")!="Baja"}
    absence_repo.lock_people(db,company,[p.id for p in people])
    absences=shift_repo.absences(db,company);zone=planning.company_zone(db,company)
    all_accounts={row.employee_id:row.user_id for row in repo.accounts(db,company,[p.id for p in people])}
    # Allocation effort is divided equally among the selected members of a space.
    employee_minutes={}
    allocations=[]
    allocated=set()
    for data in resolved:
        selection,space=data["selection"],data["space"]
        individual=ceil(data["minutes"]/len(data["workers"])) if data["workers"] else None
        for employee in data["workers"]:
            ghost=StaffShift(employee_id=employee.id,starts_at=task.scheduled_start_at,ends_at=task.scheduled_start_at+timedelta(minutes=individual))
            effective=planning.effective_person(ghost,absences,zone)
            if effective is None:raise HTTPException(409,f"{employee.name} tiene una ausencia sin cobertura. Selecciona una sustitución.")
            if effective not in active_people:raise HTTPException(409,"La sustitución ya no está disponible.")
            if (space.id,effective) in allocated:raise HTTPException(409,"La cobertura asigna dos puestos del mismo espacio a la misma persona. Revisa la sustitución.")
            allocated.add((space.id,effective))
            row=TaskSpaceStaff(company_id=company,task_id=task.id,space_id=space.id,space_name=data.get("space_label",space.name),
                employee_id=effective,crew_id=selection.crew_id,planned_minutes=individual)
            db.add(row);db.flush();allocations.append(row)
            employee_minutes[effective]=employee_minutes.get(effective,0)+individual
            user_id=all_accounts.get(effective)
            if user_id is not None and not any(assignment.user_id==user_id for assignment in task.assignments):
                task.assignments.append(TaskAssignment(user_id=user_id,source="checklist",status="pending"))
            for item in task.checklist_items:
                if item.location_space_task_template_id not in selection.task_ids:continue
                db.add(StaffChecklistProgress(allocation_id=row.id,checklist_id=item.id,completed=False))
                if user_id is not None and not any(assignment.user_id==user_id for assignment in item.assignments):
                    item.assignments.append(TaskChecklistAssignment(user_id=user_id,status="pending"))
    for employee,minutes in employee_minutes.items():
        whole_shift=StaffShift(employee_id=employee,starts_at=task.scheduled_start_at,ends_at=task.scheduled_start_at+timedelta(minutes=minutes))
        if planning.effective_person(whole_shift,absences,zone)!=employee:
            raise HTTPException(409,"La duración total del reparto coincide con una ausencia. Revisa la cobertura del trabajador y su sustituto.")
        db.add(StaffShift(company_id=company,employee_id=employee,location_id=task.location_id,task_id=task.id,
            starts_at=task.scheduled_start_at,ends_at=task.scheduled_start_at+timedelta(minutes=minutes)))
    if employee_minutes:
        planned_end=task.scheduled_start_at+timedelta(minutes=max(employee_minutes.values()))
        if task.due_at is None:task.due_at=planned_end
    db.flush();planning.validate_coverage(db,company)
