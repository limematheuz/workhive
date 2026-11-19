"""Build immutable public manifests from an explicit, reviewed selection."""
from datetime import timezone
from hashlib import sha256
import json
from fastapi import HTTPException
from app.repositories import task_client_publication as repo


def iso(value):
    if value is None:
        return None
    return (value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def candidates(db, task, started_at=None, timezone_name="UTC"):
    rows = repo.reports(db, task.company_id, task.id)
    reports = [dict(id=row.id, kind=row.report_type, title=row.title, text=row.description,
        checklist_label=row.checklist_item_label, created_at=iso(row.created_at), has_photo=bool(row.media_key)) for row in rows[:200]]
    checklist = [dict(id=item.id, text=item.text, completed=item.completed, space_name=item.space_name) for item in task.checklist_items]
    task_data = dict(id=task.id, title=task.title, location_id=task.location_id, location_name=task.location.name,
        client_name=task.location.client.name if task.location.client else None, status=task.status, timezone=timezone_name,
        scheduled_start_at=iso(task.scheduled_start_at), started_at=iso(started_at), completed_at=iso(task.date_done))
    source_hash = digest(dict(task=task_data, reports=reports, checklist=checklist,
        media=[(row.id, row.media_key) for row in rows[:200]]))
    return task_data, checklist, reports, rows[:200], source_hash, len(rows) > 200


def blocked(task, active_sessions):
    if not task.location.is_active:
        return "La ubicación está archivada. Revisa su estado antes de compartir un parte."
    client = task.location.client
    if client is None or client.company_id != task.company_id or not client.is_active:
        return "Vincula la ubicación a un cliente activo de esta empresa antes de compartir un parte."
    if task.status != "completed" or task.date_done is None:
        return "Completa el trabajo y su fecha de cierre antes de publicar el parte para el cliente."
    if active_sessions:
        return "Hay sesiones de trabajo abiertas. Ciérralas antes de publicar el parte."
    return None


def selected_content(task, checklist, reports, payload, started_at, timezone_name="UTC"):
    checks = {item["id"]: item for item in checklist}
    records = {row.id: row for row in reports}
    if not set(payload.checklist_item_ids) <= checks.keys() or not set(payload.report_ids) <= records.keys():
        raise HTTPException(422, "Selecciona únicamente tareas y reportes de esta ejecución y empresa.")
    manifest = dict(schema_version=1, task_id=task.id, title=task.title, location_name=task.location.name, timezone=timezone_name,
        scheduled_start_at=iso(task.scheduled_start_at), started_at=iso(started_at), completed_at=iso(task.date_done),
        public_summary=payload.public_summary,
        checklist=[dict(reference=f"check-{id}", **{key: checks[id][key] for key in ("text", "completed", "space_name")}) for id in payload.checklist_item_ids],
        reports=[dict(reference=f"report-{id}", kind=records[id].report_type, title=records[id].title, text=records[id].description,
            checklist_label=records[id].checklist_item_label, created_at=iso(records[id].created_at)) for id in payload.report_ids], photos=[])
    return manifest, [records[id] for id in payload.report_ids if records[id].media_key]


def acceptance(row, revision):
    return None if row is None else dict(revision=revision, signer_name=row.signer_name, accepted_at=iso(row.accepted_at), statement_version=row.statement_version)


def response(publication, history=()):
    if digest(publication.manifest) != publication.manifest_hash:
        raise HTTPException(409, "No se puede verificar la revisión publicada del parte.")
    return dict(id=publication.id, revision=publication.revision, manifest_hash=publication.manifest_hash,
        published_at=iso(publication.published_at), manifest=publication.manifest,
        acceptance=acceptance(publication.acceptance, publication.revision),
        previous_acceptances=[acceptance(row, revision) for task_id, revision, row in history if task_id == publication.task_id and revision != publication.revision])
