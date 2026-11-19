from datetime import timezone
from fastapi import HTTPException
from app.models.staff_shift import StaffShift
from app.repositories import staff_shift as shifts,staff_roster as repo
from app.services import staff_shift_service as planning
from app.services.user_scope import require_company_context


def read(db,user,start,end,offset=0):
    if start.utcoffset() is None or end.utcoffset() is None or not 0<(end-start).total_seconds()<=31*86400:
        raise HTTPException(422,"Selecciona un periodo de hasta 31 días con zona horaria.")
    company=require_company_context(user)
    records=planning.scoped(db,user,"work.manage").filter(StaffShift.starts_at<end.astimezone(timezone.utc),
        StaffShift.ends_at>start.astimezone(timezone.utc)).order_by(StaffShift.id).offset(offset).limit(501).all()
    absences=shifts.absences(db,company)
    zone=planning.company_zone(db,company)
    rows=[planning.serialize(record,absences,zone) for record in records[:500]]
    ids={r["employee_id"] for r in rows}|{r["effective_employee_id"] for r in rows if r["effective_employee_id"] is not None}
    people=repo.people(db,company,ids)
    progress={}
    for allocation,step in repo.allocation_progress(db,company,{row["task_id"] for row in rows if row["task_id"] is not None}):
        key=(allocation.task_id,allocation.employee_id,allocation.space_id)
        record=progress.setdefault(key,dict(space_id=allocation.space_id,space_name=allocation.space_name,total=0,done=0,checklist_ids=[]))
        if step:record["total"]+=1;record["done"]+=int(step.completed);record["checklist_ids"].append(step.checklist_id)
    for row in rows:
        row["space_progress"]=[item for (task,employee,space),item in progress.items() if task==row["task_id"] and employee==row["effective_employee_id"]]
        person=people.get(row["effective_employee_id"])
        row["employee_name"]=person[0] if person else None
        row["account_user_id"]=person[1] if person else None
        row["planned_account_user_id"]=people.get(row["employee_id"],("Trabajador",None))[1]
        row["planned_employee_name"]=people.get(row["employee_id"],("Trabajador",None))[0]
    return dict(items=rows,has_more=len(records)>500)
