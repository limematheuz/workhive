"""Structured availability; legacy free text is retained but never interpreted."""
from datetime import datetime, time, timedelta
from fastapi import HTTPException
from app.core.datetime import as_utc
from app.repositories import location as location_repo
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context


def validate_profile_locations(db, user, profile):
    ids = profile.compatible_location_ids
    if ids is None:
        return
    company = require_company_context(user)
    accessible = set(location_repo.list_accessible_location_ids(db, company_id=company))
    scope = permitted_location_ids(db, user, "work.manage")
    if not set(ids) <= accessible or (scope is not None and not set(ids) <= scope):
        raise HTTPException(422, "Los centros compatibles deben estar activos y autorizados para tu empresa y ámbito.")


def covers_weekly(slots, starts_at, ends_at, zone):
    start, end = as_utc(starts_at).astimezone(zone), as_utc(ends_at).astimezone(zone)
    day = start.date()
    while day <= (end - timedelta(microseconds=1)).date():
        left = max(start, datetime.combine(day, time.min, zone))
        right = min(end, datetime.combine(day + timedelta(days=1), time.min, zone))
        ranges = sorted((row["starts_at"], row["ends_at"]) for row in slots if row["weekday"] == day.weekday())
        cursor = left
        for begins, finishes in ranges:
            slot_start = datetime.combine(day, time.fromisoformat(begins), zone)
            slot_end = datetime.combine(day + timedelta(days=1), time.min, zone) if finishes == "24:00" else datetime.combine(day, time.fromisoformat(finishes), zone)
            if slot_start <= cursor < slot_end:
                cursor = slot_end
            if cursor >= right:
                break
        if cursor < right:
            return False
        day += timedelta(days=1)
    return True


def eligibility_issues(employee, location_id, starts_at, ends_at, zone, required=(), *, strict=False):
    profile = employee.profile or {}
    issues = []
    state = profile.get("state", "Activo")
    if state != "Activo":
        issues.append("Estado no disponible: " + state)
    locations = profile.get("compatible_location_ids")
    slots = profile.get("weekly_availability")
    if locations is None:
        if strict:
            issues.append("Centros compatibles pendientes de configurar")
    elif location_id not in locations:
        issues.append("Centro no incluido en sus ubicaciones compatibles")
    if slots is None:
        if strict:
            issues.append("Disponibilidad semanal pendiente de configurar")
    else:
        try:
            if not covers_weekly(slots, starts_at, ends_at, zone):
                issues.append("El horario no está cubierto por su disponibilidad semanal")
        except (KeyError, TypeError, ValueError):
            issues.append("Revisa las franjas de disponibilidad guardadas")
    first = as_utc(starts_at).astimezone(zone).date().isoformat()
    last = (as_utc(ends_at) - timedelta(microseconds=1)).astimezone(zone).date().isoformat()
    qualified = {
        row.get("qualification_code") for row in profile.get("documents", [])
        if row.get("document_type") == "training" and row.get("qualification_code")
        and (not row.get("issued_on") or row["issued_on"] <= first)
        and (not row.get("expires_on") or row["expires_on"] >= last)
    }
    missing = set(required) - qualified
    if missing:
        issues.append("Formación no acreditada o caducada: " + ", ".join(sorted(missing)))
    return issues


def require_eligible(employee, shift, zone, required=(), *, strict=False):
    issues = eligibility_issues(employee, shift.location_id, shift.starts_at, shift.ends_at, zone, required, strict=strict)
    if issues:
        raise HTTPException(409, employee.name + ": " + "; ".join(issues))
