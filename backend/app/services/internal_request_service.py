from datetime import datetime,timezone
from fastapi import HTTPException
from app.models.internal_request import InternalRequest
from app.repositories import internal_request as repo,staff_account as account_repo,staff as staff_repo
from app.services.organization_authorization_service import has_capability,require_capability
from app.services.user_scope import require_company_context
from app.services.entitlement_service import require_company_feature,company_feature_enabled
from app.schemas.staff_absence import AbsenceInput
from app.services import staff_absence_service

LABOR_KINDS={"vacation","shift","advance","extra_hours"}
RESOURCE_KINDS={"purchase","material"}


def serialize(row):
    values={key:getattr(row,key) for key in ("id","employee_id","kind","description","starts_on","ends_on","amount","status","absence_id")}
    approval=row.purchase_link.approval if row.purchase_link else None
    return {**values,"purchase_approval_id":approval.id if approval else None,"purchase_id":approval.purchase_id if approval else None}


def choices(db,user):
    company=require_company_context(user)
    if has_capability(db,user,"labor_costs.manage") or has_capability(db,user,"inventory.manage"):
        people=staff_repo.list_staff(db,company)
    else:
        person=account_repo.own_employee(db,company,user.id)
        people=[person] if person else []
    return [dict(id=p.id,name=p.name) for p in people]


def create(db,user,payload):
    company=require_company_context(user)
    require_company_feature(db,company_id=company,code="features.hr" if payload.kind in LABOR_KINDS else "features.inventory")
    own=account_repo.own_employee(db,company,user.id)
    if not own or own.id!=payload.employee_id:
        require_capability(db,user,"labor_costs.manage" if payload.kind in LABOR_KINDS else "inventory.manage")
    if staff_repo.employee(db,company,payload.employee_id) is None:
        raise HTTPException(404,"Trabajador no encontrado")
    row=InternalRequest(company_id=company,created_by=user.id,**payload.model_dump())
    db.add(row);db.commit()
    return serialize(row)


def list_requests(db,user,review=False):
    company=require_company_context(user)
    rows=repo.rows(db,company)
    if review:
        kinds=set()
        if has_capability(db,user,"labor_costs.manage"):kinds|=LABOR_KINDS
        if has_capability(db,user,"inventory.manage"):kinds|=RESOURCE_KINDS
        if not kinds:raise HTTPException(403,"No puedes revisar solicitudes.")
        rows=rows.filter(InternalRequest.kind.in_(kinds))
    else:
        rows=rows.filter(InternalRequest.created_by==user.id)
    return [serialize(r) for r in rows.order_by(InternalRequest.id.desc())]


def decide(db,user,item_id,payload):
    company=require_company_context(user)
    row=repo.rows(db,company).filter_by(id=item_id).with_for_update().first()
    if row is None:raise HTTPException(404,"Solicitud no encontrada")
    require_company_feature(db,company_id=company,code="features.approvals")
    require_capability(db,user,"labor_costs.manage" if row.kind in LABOR_KINDS else "inventory.manage")
    if row.status!="pending":
        if row.status==payload.decision:return serialize(row)
        raise HTTPException(409,"La solicitud ya fue revisada.")
    try:
        if payload.decision=="approved" and row.kind=="vacation":
            absence=staff_absence_service.save(db,user,AbsenceInput(employee_id=row.employee_id,starts_on=row.starts_on,
                ends_on=row.ends_on,kind="Vacaciones"),commit=False)
            row.absence_id=absence.id
        row.status,row.reviewed_by,row.reviewed_at=payload.decision,user.id,datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return serialize(row)


def access(db,user):
    company=require_company_context(user);kinds=[]
    if company_feature_enabled(db,company_id=company,code="features.hr"):kinds.extend(sorted(LABOR_KINDS))
    if company_feature_enabled(db,company_id=company,code="features.inventory"):kinds.extend(sorted(RESOURCE_KINDS))
    return dict(kinds=kinds,can_review=company_feature_enabled(db,company_id=company,code="features.approvals") and (has_capability(db,user,"labor_costs.manage") or has_capability(db,user,"inventory.manage")))
