from datetime import date
from hashlib import sha256
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.models.staff_account import StaffAccount,StaffDocumentReceipt
from app.repositories import staff_account as repo,staff as staff_repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context
from app.services.entitlement_service import require_company_feature


def link_account(db,user,employee,email):
    link = repo.employee_link(db,employee.company_id,employee.id)
    if not email:
        if link:
            db.delete(link)
        return
    person = repo.user_by_email(db,employee.company_id,email)
    if not person or person.role.name not in {"admin","manager","viewer"}:
        raise HTTPException(422,"Selecciona el correo de un acceso interno activo de esta empresa.")
    if link is None:
        link = StaffAccount(employee_id=employee.id,company_id=employee.company_id)
        db.add(link)
    link.user_id = person.id


def digest(document):
    return sha256(repr(sorted(document.items())).encode()).hexdigest()


def documents(db,user,own=False):
    company = require_company_context(user)
    require_company_feature(db,company_id=company,code="features.hr")
    if own:
        employee = repo.own_employee(db,company,user.id)
        people = [employee] if employee else []
    else:
        require_capability(db,user,"labor_costs.read")
        people = staff_repo.list_staff(db,company)
    receipts = repo.receipts(db,[e.id for e in people])
    result = []
    today = date.today().isoformat()
    for employee in people:
        for document in (employee.profile or {}).get("documents",[]):
            stamp = digest(document)
            receipt = next((r for r in receipts if r.employee_id==employee.id and r.digest==stamp),None)
            expiry = document.get("expires_on")
            result.append(dict(employee_id=employee.id,employee=employee.name,digest=stamp,**document,
                               expired=bool(expiry and expiry<today),
                               acknowledged_at=receipt.acknowledged_at if receipt else None))
    return result


def acknowledge(db,user,stamp):
    available = documents(db,user,own=True)
    document = next((d for d in available if d["digest"]==stamp),None)
    if not document:
        raise HTTPException(404,"Documento propio no encontrado")
    if document["acknowledged_at"] is None:
        db.add(StaffDocumentReceipt(employee_id=document["employee_id"],user_id=user.id,digest=stamp))
        try:db.commit()
        except IntegrityError:
            db.rollback()
            if not any(d["digest"]==stamp and d["acknowledged_at"] for d in documents(db,user,own=True)):raise
    return {"ok":True}
