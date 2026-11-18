from datetime import datetime,timezone
from fastapi import HTTPException
from app.models.advisory_request import AdvisoryRequest
from app.repositories import advisory_request as repo
from app.services.advisory_service import require_area
from app.services.external_access_policy import is_external_portal_user
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


def serialize(row):return {key:getattr(row,key) for key in ("id","requested_by","area","description","response","created_at","answered_at")}


def read(db,user,company):
    external=is_external_portal_user(user)
    # Check at least one currently authorised area, then restrict each row to its own area.
    areas=[]
    for area in ("accounting","payroll"):
        try:require_area(db,user,company,area);areas.append(area)
        except HTTPException as exc:
            if exc.status_code not in {403,404}:raise
    if not areas:raise HTTPException(403,"No hay un área de gestoría autorizada.")
    query=repo.rows(db,company,user.id if external else None).filter(AdvisoryRequest.area.in_(areas))
    return [serialize(row) for row in query.order_by(AdvisoryRequest.id.desc()).limit(200)]


def create(db,user,company,payload):
    if not is_external_portal_user(user):raise HTTPException(403,"La petición debe proceder de la gestoría autorizada.")
    require_area(db,user,company,payload.area)
    row=AdvisoryRequest(company_id=company,requested_by=user.id,**payload.model_dump())
    db.add(row);db.commit()
    return serialize(row)


def answer(db,user,company,record_id,payload):
    if is_external_portal_user(user) or require_company_context(user)!=company:raise HTTPException(403,"Responde desde la empresa autorizada.")
    row=repo.rows(db,company).filter(AdvisoryRequest.id==record_id).with_for_update().first()
    if row is None:raise HTTPException(404,"Petición no encontrada")
    require_area(db,user,company,row.area)
    require_capability(db,user,"finance.manage" if row.area=="accounting" else "labor_costs.manage")
    row.response=payload.response;row.answered_by=user.id;row.answered_at=datetime.now(timezone.utc)
    db.commit()
    return serialize(row)
