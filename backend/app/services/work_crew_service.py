from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.models.workforce_plan import WorkCrew,WorkCrewMember
from app.models.audit_log import AuditLog
from app.repositories import workforce_plan as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


def serialize(crew,members):
    return dict(id=crew.id,name=crew.name,description=crew.description,leader_employee_id=crew.leader_employee_id,
        is_active=crew.is_active,employee_ids=[m.employee_id for m in members if m.crew_id==crew.id])


def read(db,user):
    company=require_company_context(user);require_capability(db,user,"labor_costs.read")
    rows=repo.crews(db,company).all();members=repo.members(db,[c.id for c in rows])
    return [serialize(row,members) for row in rows]


def save(db,user,payload,crew_id=None):
    company=require_company_context(user);require_capability(db,user,"labor_costs.manage")
    crew=repo.crew(db,company,crew_id) if crew_id is not None else WorkCrew(company_id=company)
    if crew is None:raise HTTPException(404,"Equipo no encontrado")
    people=repo.people(db,company,payload.employee_ids).with_for_update().all()
    if len(people)!=len(payload.employee_ids):raise HTTPException(422,"Los miembros deben pertenecer a la empresa.")
    previous_name=crew.name
    crew.name,crew.description,crew.leader_employee_id,crew.is_active=payload.name.strip(),payload.description,payload.leader_employee_id,payload.is_active
    if not crew.name:raise HTTPException(422,"Indica el nombre del equipo.")
    db.add(crew)
    try:
        db.flush()
        old=repo.members(db,[crew.id]);selected=set(payload.employee_ids)
        for member in old:
            if member.employee_id not in selected:db.delete(member)
        existing={member.employee_id for member in old}
        for person in people:
            if person.id not in existing:db.add(WorkCrewMember(crew_id=crew.id,employee_id=person.id))
            if not person.team or person.team==previous_name:person.team=crew.name
        for person in repo.people(db,company).filter_by(team=previous_name).all() if previous_name else []:
            if person.id not in selected:person.team=""
        db.add(AuditLog(company_id=company,actor_user_id=user.id,action="staff.crew_saved",entity_type="work_crew",entity_id=str(crew.id),details={"member_ids":payload.employee_ids}))
        db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,"Ya existe un equipo con ese nombre.")
    return serialize(crew,repo.members(db,[crew.id]))


def sync_primary(db,employee,previous_team=None):
    if previous_team and previous_team!=employee.team:
        previous=repo.crews(db,employee.company_id).filter_by(name=previous_team).first()
        if previous:
            for member in repo.members(db,[previous.id]):
                if member.employee_id==employee.id:db.delete(member)
    if not employee.team:return
    crew=repo.crews(db,employee.company_id).filter_by(name=employee.team).first()
    if crew is None:crew=WorkCrew(company_id=employee.company_id,name=employee.team,description="",is_active=True);db.add(crew);db.flush()
    if not any(member.employee_id==employee.id for member in repo.members(db,[crew.id])):db.add(WorkCrewMember(crew_id=crew.id,employee_id=employee.id))
