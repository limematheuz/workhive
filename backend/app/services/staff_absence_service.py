from app.models.audit_log import AuditLog
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.staff_absence import StaffAbsence, StaffReservationDay
from app.models.user import User
from app.schemas.staff_absence import AbsenceInput
from app.repositories import staff_absence as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context

def list_absences(db: Session, current_user: User):
    company = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.read")
    return repo.list_absences(db, company)


def save(db, user, payload, record_id=None, *, commit=True):
    company = require_company_context(user)
    require_capability(db, user, "labor_costs.manage")
    people = [payload.employee_id]
    if payload.substitute_id is not None:
        people.append(payload.substitute_id)
    from app.repositories.staff import list_staff
    all_people = repo.lock_people(db, company, [e.id for e in list_staff(db, company)])
    employees = [e for e in all_people if e.id in people]
    if len(employees) != len(people):
        raise HTTPException(404, "Trabajador no encontrado")
    if any(e.id == payload.substitute_id and (e.profile or {}).get("state", "Activo") != "Activo" for e in employees):
        raise HTTPException(409, "El sustituto no está en estado Activo.")
    if record_id is None:
        record = StaffAbsence(company_id=company)
        db.add(record)
    else:
        record = repo.absence(db, company, record_id)
        if record is None:
            raise HTTPException(404, "Ausencia no encontrada")
        repo.clear_days(db, record.id)
    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    try:
        db.flush()
        for offset in range((payload.ends_on - payload.starts_on).days + 1):
            for person in people:
                db.add(StaffReservationDay(absence_id=record.id, employee_id=person, day=payload.starts_on + timedelta(days=offset)))
        from app.services.staff_shift_service import validate_coverage
        db.flush()
        validate_coverage(db, company, all_people)
        db.add(AuditLog(company_id=company,actor_user_id=user.id,action="staff.absence_saved",entity_type="staff_absence",entity_id=str(record.id),details={"fields":list(payload.model_fields_set)}))
        if commit:
            db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "La persona ya tiene una ausencia o sustitución en estas fechas.")
    except Exception:
        db.rollback()
        raise
    db.refresh(record)
    return record


def register(payload: AbsenceInput, db: Session, current_user: User):
    return save(db, current_user, payload)


def update(record_id: int, payload: AbsenceInput, db: Session, current_user: User):
    return save(db, current_user, payload, record_id)
