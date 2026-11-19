from app.models.audit_log import AuditLog
from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.staff_employee import StaffEmployee
from app.models.user import User
from app.schemas.staff import EmployeeInput
from app.repositories import staff as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context
from app.services.staff_documentation_service import link_account
from app.services.staff_document_file_service import validate_owner
from sqlalchemy.exc import IntegrityError

def update_history(employee, payload):
    total = sum(getattr(payload.profile, key) for key in ("gross","extra","bonus","insurance","other"))
    source="monthly" if total>0 else "hourly" if payload.hourly_cost>0 else "unknown"
    reference=total if total>0 else payload.hourly_cost*payload.monthly_hours
    employee.history = {**(employee.history or {}), date.today().isoformat()[:7]: {"cost": str(reference), "hours": str(payload.monthly_hours),"source":source}}


def list_staff(db: Session, current_user: User):
    company = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.read")
    return repo.list_staff(db, company)


def create_staff(payload: EmployeeInput, db: Session, current_user: User, *, commit=True):
    company = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.manage")
    from app.services.staff_availability_policy import validate_profile_locations
    validate_profile_locations(db,current_user,payload.profile)
    employee = StaffEmployee(company_id=company, **payload.model_dump(mode="json"))
    update_history(employee, payload)
    db.add(employee)
    try:
        db.flush()
        from app.services.work_crew_service import sync_primary
        sync_primary(db,employee)
        validate_owner(db,employee,payload.profile.documents)
        link_account(db,current_user,employee,payload.profile.account_email.strip().lower())
        db.add(AuditLog(company_id=company,actor_user_id=current_user.id,action="staff.saved",entity_type="staff_employee",entity_id=str(employee.id),details={"fields":list(payload.model_fields_set)}))
        if commit:
            db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,"Ese acceso ya está vinculado a otro trabajador.")
    db.flush()
    db.refresh(employee)
    return employee


def edit_staff(employee_id: int, payload: EmployeeInput, db: Session, current_user: User):
    company = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.manage")
    employee = repo.employee(db, company, employee_id)
    if employee is None:
        raise HTTPException(404, "Trabajador no encontrado")
    from app.services.staff_availability_policy import validate_profile_locations
    validate_profile_locations(db,current_user,payload.profile)
    previous_team=employee.team
    for key, value in payload.model_dump(mode="json").items():
        setattr(employee, key, value)
    update_history(employee, payload)
    try:
        db.flush()
        from app.services.work_crew_service import sync_primary
        sync_primary(db,employee,previous_team)
        validate_owner(db,employee,payload.profile.documents)
        link_account(db,current_user,employee,payload.profile.account_email.strip().lower())
        db.add(AuditLog(company_id=company,actor_user_id=current_user.id,action="staff.saved",entity_type="staff_employee",entity_id=str(employee.id),details={"fields":list(payload.model_fields_set)}))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,"Ese acceso ya está vinculado a otro trabajador.")
    db.flush()
    db.refresh(employee)
    return employee
