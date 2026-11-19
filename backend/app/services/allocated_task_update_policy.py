"""Traditional task edits cannot invalidate a persisted staff/space allocation."""
from datetime import timezone
from fastapi import HTTPException
from app.repositories import workforce_plan


def _instant(value):
    if value is None:
        return None
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def require_consistent_scope(db, task, payload):
    changes = payload.model_fields_set
    fields = {"location_id", "zone_ids", "space_ids", "scheduled_start_at", "due_at"}
    if not fields & changes:
        return
    changed = "location_id" in changes and payload.location_id != task.location_id
    changed = changed or any(field in changes and _instant(getattr(payload, field)) != _instant(getattr(task, field)) for field in ("scheduled_start_at", "due_at"))
    if {"zone_ids", "space_ids"} & changes:
        existing = {zone.zone_id for zone in task.zones}
        changed = changed or any(field in changes and set(getattr(payload, field) or []) != existing for field in ("zone_ids", "space_ids"))
    if changed and workforce_plan.allocations(db, task.company_id, [task.id]).first() is not None:
        raise HTTPException(409, "El trabajo tiene un reparto por espacios. Ajusta espacios y personas desde Editar reparto; crea otra ejecución para cambiar su ubicación u horario.")
