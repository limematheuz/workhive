from app.models.audit_log import AuditLog
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.models.staff_shift import StaffShift
from app.repositories import staff_shift as repo, staff as staff_repo
from app.repositories import staff_absence as absence_repo
from app.services import location_access_service
from app.services.organization_authorization_service import permitted_location_ids, require_capability
from app.services.user_scope import require_company_context


def utc(value):
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def effective_person(shift, absences, zone):
    start = utc(shift.starts_at).astimezone(zone).date()
    end = (utc(shift.ends_at) - timedelta(microseconds=1)).astimezone(zone).date()
    matching = [a for a in absences if a.employee_id == shift.employee_id and a.starts_on <= end and a.ends_on >= start]
    if not matching:
        return shift.employee_id
    if len(matching) == 1 and matching[0].starts_on <= start and matching[0].ends_on >= end:
        return matching[0].substitute_id
    return None


def company_zone(db, company):
    from app.services.company_preferences_service import preferences
    return ZoneInfo(preferences(db, company)["timezone"])


def validate_coverage(db, company, people=None):
    zone = company_zone(db, company)
    absences = repo.absences(db, company)
    rows = repo.shifts(db, company).order_by(StaffShift.starts_at, StaffShift.id).all()
    occupied = {}
    staff = {person.id: person for person in (people if people is not None else staff_repo.list_staff(db, company))}
    for shift in rows:
        person = effective_person(shift, absences, zone)
        if person is None:
            continue
        employee = staff.get(person)
        if employee is not None and utc(shift.starts_at) >= datetime.now(timezone.utc):
            from app.services.staff_availability_policy import require_eligible
            require_eligible(employee, shift, zone)
        end = occupied.get(person)
        if end is not None and utc(shift.starts_at) < end:
            raise HTTPException(409, "El trabajador o sustituto tiene turnos solapados.")
        occupied[person] = utc(shift.ends_at)


def scoped(db, user, permission):
    company = require_company_context(user)
    locations = permitted_location_ids(db, user, permission)
    rows = repo.shifts(db, company)
    return rows if locations is None else rows.filter(StaffShift.location_id.in_(locations))


def serialize(shift, absences, zone):
    person = effective_person(shift, absences, zone)
    return dict(id=shift.id, employee_id=shift.employee_id, location_id=shift.location_id, task_id=shift.task_id,
                starts_at=utc(shift.starts_at), ends_at=utc(shift.ends_at), effective_employee_id=person,
                coverage="Sin cubrir" if person is None else "Sustitución" if person != shift.employee_id else "Asignado")


def list_shifts(db, user):
    company = require_company_context(user)
    require_capability(db, user, "labor_costs.read")
    absences = repo.absences(db, company)
    zone = company_zone(db, company)
    return [serialize(s, absences, zone) for s in scoped(db, user, "work.read").order_by(StaffShift.starts_at).all()]


def save(db, user, payload, shift_id=None):
    company = require_company_context(user)
    require_capability(db, user, "labor_costs.manage")
    location_access_service.require_location_capability(db, user, payload.location_id, "can_manage_tasks", permission_code="work.manage")
    # Serialize staff planning changes and absence changes for this company.
    people = absence_repo.lock_people(db, company, [e.id for e in staff_repo.list_staff(db, company)])
    if not any(p.id == payload.employee_id and (p.profile or {}).get("state") != "Baja" for p in people):
        raise HTTPException(422, "Selecciona un trabajador activo.")
    if payload.task_id:
        task = repo.task(db, company, payload.task_id)
        if not task or task.location_id != payload.location_id:
            raise HTTPException(422, "El trabajo debe pertenecer a la ubicación del turno.")
    shift = StaffShift(company_id=company) if shift_id is None else scoped(db, user, "work.manage").filter_by(id=shift_id).with_for_update().first()
    if shift is None:
        raise HTTPException(404, "Turno no encontrado")
    for key, value in payload.model_dump().items():
        setattr(shift, key, value)
    db.add(shift)
    try:
        db.flush()
        validate_coverage(db, company, people)
        db.add(AuditLog(company_id=company,actor_user_id=user.id,action="staff.shift_saved",entity_type="staff_shift",entity_id=str(shift.id),details=payload.model_dump(mode="json")))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return serialize(shift, repo.absences(db, company), company_zone(db, company))
