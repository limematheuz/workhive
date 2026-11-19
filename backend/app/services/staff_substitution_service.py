from datetime import datetime, time, timedelta
from fastapi import HTTPException
from app.core.datetime import as_utc
from app.models.audit_log import AuditLog
from app.repositories import staff_substitution as repo, staff as staff_repo, staff_absence as absence_repo
from app.schemas.staff_absence import AbsenceInput
from app.services import staff_availability_policy as policy, staff_shift_service as shifts, location_access_service
from app.services.organization_authorization_service import require_capability, permitted_location_ids
from app.services.entitlement_service import require_company_feature
from app.services.user_scope import require_company_context


def context(db, user, payload, *, manage=False):
    company = require_company_context(user)
    require_capability(db, user, "labor_costs.manage" if manage else "labor_costs.read")
    require_company_feature(db, company_id=company, code="features.hr")
    location_access_service.require_location_capability(db, user, payload.location_id, "can_manage_tasks", permission_code="work.manage" if manage else "work.read")
    zone = shifts.company_zone(db, company)
    record = absence_repo.absence(db, company, payload.absence_id) if payload.absence_id else None
    if payload.absence_id and record is None:
        raise HTTPException(404, "Ausencia no encontrada.")
    if record and (payload.starts_at.astimezone(zone).date() < record.starts_on or (payload.ends_at - timedelta(microseconds=1)).astimezone(zone).date() > record.ends_on):
        raise HTTPException(422, "El periodo debe estar dentro de la ausencia seleccionada.")
    return company, zone, record


def candidate_issues(db, company, person, payload, zone, record):
    issues = policy.eligibility_issues(person, payload.location_id, payload.starts_at, payload.ends_at, zone, payload.required_training_codes, strict=True)
    if record and person.id == record.employee_id:
        issues.append("Es la persona ausente")
    first = payload.starts_at.astimezone(zone).date()
    last = (payload.ends_at - timedelta(microseconds=1)).astimezone(zone).date()
    absences = repo.overlapping_absences(db, company, [person.id], first, last)
    if any(row.id != payload.absence_id for row in absences):
        issues.append("Tiene una ausencia o sustitución en este periodo")
    original_ids = {person.id, *(row.employee_id for row in absences if row.substitute_id == person.id)}
    planned = repo.overlapping_shifts(db, company, original_ids, payload.starts_at, payload.ends_at)
    if len(planned) > 2000:
        raise HTTPException(422, "Demasiados turnos para este periodo. Acota la búsqueda.")
    if any(shifts.effective_person(row, absences, zone) == person.id and not (record and row.employee_id == record.employee_id) for row in planned):
        issues.append("Tiene otro turno programado en ese horario")
    return issues


def search(db, user, payload):
    company, zone, record = context(db, user, payload)
    page = repo.people_page(db, company, payload.offset)
    # Resolve conflicts in batches, independent of the number of displayed staff.
    ids = [person.id for person in page[:100]]
    first, last = payload.starts_at.astimezone(zone).date(), (payload.ends_at - timedelta(microseconds=1)).astimezone(zone).date()
    absences = repo.overlapping_absences(db, company, ids, first, last)
    origins = set(ids) | {row.employee_id for row in absences if row.substitute_id in ids}
    planned = repo.overlapping_shifts(db, company, origins, payload.starts_at, payload.ends_at)
    if len(absences) > 1000 or len(planned) > 2000:
        raise HTTPException(422, "Demasiados registros en este periodo. Acota la búsqueda.")
    busy = set()
    for row in planned:
        if record and row.employee_id == record.employee_id:
            continue
        effective = shifts.effective_person(row, absences, zone)
        if effective is not None:
            busy.add(effective)
    unavailable = {identifier for row in absences if row.id != payload.absence_id for identifier in (row.employee_id, row.substitute_id)}
    result = []
    for person in page[:100]:
        issues = policy.eligibility_issues(person, payload.location_id, payload.starts_at, payload.ends_at, zone, payload.required_training_codes, strict=True)
        if record and person.id == record.employee_id:
            issues.append("Es la persona ausente")
        if person.id in unavailable:
            issues.append("Tiene una ausencia o sustitución en este periodo")
        if person.id in busy:
            issues.append("Tiene otro turno programado en ese horario")
        result.append(dict(id=person.id, name=person.name, position=person.position, state=(person.profile or {}).get("state", "Activo"), eligible=not issues, reasons=issues))
    return dict(items=result, has_more=len(page)>100, timezone=str(zone))


def assign(db, user, payload):
    company, zone, record = context(db, user, payload, manage=True)
    absence_repo.lock_people(db, company, [person.id for person in staff_repo.list_staff(db, company)])
    person = staff_repo.employee(db, company, payload.employee_id)
    if person is None:
        raise HTTPException(404, "Trabajador no encontrado.")
    issues = candidate_issues(db, company, person, payload, zone, record)
    if issues:
        raise HTTPException(409, "; ".join(issues))
    start = datetime.combine(record.starts_on, time.min, zone)
    end = datetime.combine(record.ends_on + timedelta(days=1), time.min, zone)
    covered = repo.coverage_shifts(db, company, record.employee_id, as_utc(start), as_utc(end))
    if len(covered) > 1000:
        raise HTTPException(422, "Divide esta ausencia en periodos menores antes de asignar cobertura.")
    allowed = permitted_location_ids(db, user, "work.manage")
    if allowed is not None and any(row.location_id not in allowed for row in covered):
        raise HTTPException(403, "La ausencia afecta a centros fuera de tu ámbito.")
    if repo.locked_tasks(db, company, [row.task_id for row in covered if row.task_id]):
        raise HTTPException(409, "La ausencia incluye trabajos ya iniciados. Divide el periodo para conservar su historial.")
    for row in covered:
        policy.require_eligible(person, row, zone, payload.required_training_codes, strict=True)
    db.add(AuditLog(company_id=company, actor_user_id=user.id, action="staff.substitute_selected", entity_type="staff_absence", entity_id=str(record.id), details=payload.model_dump(mode="json")))
    from app.services.staff_absence_service import save
    return save(db, user, AbsenceInput(employee_id=record.employee_id, substitute_id=person.id, starts_on=record.starts_on, ends_on=record.ends_on, kind=record.kind), record.id)
