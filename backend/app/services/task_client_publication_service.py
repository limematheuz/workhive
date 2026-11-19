"""Explicit company publication and customer validation of immutable work parts."""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.audit_log import AuditLog
from app.models.task_client_publication import TaskClientPublication, TaskClientAcceptance
from app.repositories import task_client_publication as repo
from app.services import task_client_publication_content as content, task_client_publication_media as media
from app.services import client_portal_policy, location_access_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context
from app.services.request_context import get_client_ip
from app.services.company_preferences_service import preferences

STATEMENT_VERSION = "published-work-acceptance-v1"


def _manager_task(db, user, task_id):
    company = require_company_context(user)
    task = repo.task(db, company, task_id)
    if task is None:
        raise HTTPException(404, "Trabajo no encontrado")
    location_access_service.require_location_capability(db, user, task.location_id, "can_manage_tasks", permission_code="work.manage")
    require_capability(db, user, "work.read", scope_type="location", scope_id=task.location_id)
    require_company_feature(db, company_id=company, code="features.client_portal")
    return task


def _history(db, grant, rows):
    return repo.acceptance_history(db, grant.company_id, grant.client_id, [row.task_id for row in rows])


def _audit(db, user, company, action, publication, request, details=None):
    db.add(AuditLog(company_id=company, actor_user_id=user.id, action=action, entity_type="task_item",
        entity_id=str(publication.task_id), request_id=getattr(request.state, "request_id", None), ip_address=get_client_ip(request),
        details={"publication_id": publication.id, "revision": publication.revision, "manifest_hash": publication.manifest_hash, **(details or {})}))


def candidate(db, user, task_id):
    task = _manager_task(db, user, task_id)
    (started, _), active = repo.work_times(db, task.id)
    task_data, checklist, reports, _, source_hash, has_more = content.candidates(db, task, started, preferences(db, task.company_id)["timezone"])
    latest = repo.latest(db, task.company_id, task.id)
    reason = content.blocked(task, active)
    return dict(task=task_data, checklist_items=checklist, reports=reports, reports_has_more=has_more,
        source_hash=source_hash, can_publish=reason is None, blocked_reason=reason,
        latest_revision=latest.revision if latest else 0, is_public=bool(latest and latest.revoked_at is None),
        latest=content.response(latest) if latest else None)


def publish(db, user, task_id, payload, request):
    keys = []
    committed = False
    try:
        task = _manager_task(db, user, task_id)
        (started, _), active = repo.work_times(db, task.id)
        reason = content.blocked(task, active)
        if reason:
            raise HTTPException(422, reason)
        zone = preferences(db, task.company_id)["timezone"]
        _, checklist, _, reports, source_hash, _ = content.candidates(db, task, started, zone)
        latest = repo.latest(db, task.company_id, task.id)
        if source_hash != payload.expected_source_hash or (latest.revision if latest else 0) != payload.expected_revision:
            raise HTTPException(409, "La ejecución o su publicación ha cambiado. Actualiza y revisa la selección antes de compartirla.")
        manifest, selected_photos = content.selected_content(task, checklist, reports, payload, started, zone)
        photos = media.copy_selected(task.company_id, selected_photos, keys)
        manifest["photos"] = media.metadata(photos)
        publication = TaskClientPublication(company_id=task.company_id, client_id=task.location.client_id,
            location_id=task.location_id, task_id=task.id, revision=(latest.revision if latest else 0) + 1,
            manifest=manifest, manifest_hash=content.digest(manifest), photos=photos,
            published_by_user_id=user.id, published_at=datetime.now(timezone.utc))
        db.add(publication); db.flush()
        _audit(db, user, task.company_id, "task.client_published", publication, request,
            {"checklist_item_ids": payload.checklist_item_ids, "report_ids": payload.report_ids, "client_id": publication.client_id})
        db.commit(); committed = True
        return candidate(db, user, task.id)
    except Exception:
        db.rollback()
        if not committed:
            media.cleanup(keys)
        raise


def revoke(db, user, task_id, payload, request):
    try:
        task = _manager_task(db, user, task_id)
        latest = repo.latest(db, task.company_id, task.id)
        if latest is None:
            raise HTTPException(404, "Este trabajo todavía no tiene un parte publicado.")
        if latest.revision != payload.expected_revision:
            raise HTTPException(409, "La publicación ha cambiado. Actualiza antes de retirarla.")
        if latest.revoked_at is None:
            latest.revoked_at = datetime.now(timezone.utc); latest.revoked_by_user_id = user.id
            _audit(db, user, task.company_id, "task.client_publication_revoked", latest, request)
            db.commit()
        return candidate(db, user, task.id)
    except Exception:
        db.rollback(); raise


def _public(db, principal, publication_id, *, current=True, lock=False):
    require_company_feature(db, company_id=principal.grant.company_id, code="features.client_portal")
    publication = repo.published(db, principal.grant, publication_id, current=current, lock=lock)
    if publication is None:
        raise HTTPException(404, "Parte no encontrado o ya retirado de este portal.")
    content.response(publication)
    return publication


def list_parts(db, principal, offset=0):
    require_company_feature(db, company_id=principal.grant.company_id, code="features.client_portal")
    rows = repo.page(db, principal.grant, offset)
    history = _history(db, principal.grant, rows[:25])
    return dict(items=[content.response(row, history) for row in rows[:25]], has_more=len(rows) > 25)


def read_part(db, principal, publication_id):
    row = _public(db, principal, publication_id)
    return content.response(row, _history(db, principal.grant, [row]))


def history(db, principal, publication_id, offset):
    row = _public(db, principal, publication_id)
    records = repo.full_history(db, principal.grant.company_id, principal.grant.client_id, row.task_id, offset)
    return dict(items=[content.acceptance(acceptance, revision) for revision, acceptance in records[:100]], has_more=len(records) > 100)


def manager_part(db, user, task_id):
    task = _manager_task(db, user, task_id)
    latest = repo.latest(db, task.company_id, task.id)
    if latest is None:
        raise HTTPException(404, "Este trabajo todavía no tiene un parte publicado.")
    return latest


def accept(db, principal, publication_id, payload, request):
    try:
        if repo.lock_grant(db, principal.user.id, principal.grant.id) is None:
            raise HTTPException(403, "El acceso al portal ya no está disponible.")
        grant = client_portal_policy.require_active_client_portal(db, current_user=principal.user, grant_id=principal.grant.id)
        publication = _public(db, principal, publication_id, current=False)
        task = repo.task(db, grant.company_id, publication.task_id)
        if task is None:
            raise HTTPException(404, "Trabajo no encontrado")
        publication = _public(db, principal, publication_id, current=False, lock=True)
        latest = repo.latest(db, grant.company_id, publication.task_id)
        if latest is None or latest.id != publication.id or latest.revoked_at is not None or publication.revision != payload.expected_revision or publication.manifest_hash != payload.expected_manifest_hash:
            raise HTTPException(409, "El parte ha cambiado o ha sido retirado. Actualiza y revisa la publicación vigente.")
        if publication.acceptance is None:
            publication.acceptance = TaskClientAcceptance(grant_id=grant.id, accepted_by_user_id=principal.user.id,
                signer_name=payload.signer_name, statement_version=STATEMENT_VERSION, manifest_hash=publication.manifest_hash,
                accepted_at=datetime.now(timezone.utc))
            _audit(db, principal.user, grant.company_id, "task.client_accepted", publication, request,
                {"grant_id": grant.id, "signer_name": payload.signer_name, "statement_version": STATEMENT_VERSION})
            db.commit()
        return read_part(db, principal, publication.id)
    except Exception:
        db.rollback(); raise


def photo(db, principal, publication_id, photo_id):
    publication = _public(db, principal, publication_id)
    return publication_photo(db, publication, photo_id)


def publication_photo(db, publication, photo_id):
    content.response(publication)
    record = repo.photo(db, publication.id, photo_id)
    if record is None:
        raise HTTPException(404, "Fotografía no encontrada en este parte.")
    if media.metadata([record])[0] not in publication.manifest.get("photos", []):
        raise HTTPException(409, "La fotografía no coincide con el manifiesto publicado.")
    return media.read(record)
