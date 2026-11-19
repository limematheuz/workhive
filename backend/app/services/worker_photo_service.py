"""Account-bound, idempotent photo synchronization through canonical reports."""
import asyncio
import hashlib
from fastapi import HTTPException
from app.repositories import async_task_item as tasks, async_task_report as reports
from app.repositories import offline_work as offline_repo
from app.schemas.task_report import TaskReportCreate
from app.services import task_assignment_service, task_report_service
from app.services.image_service import MAX_IMAGE_BYTES, store_image, validate_image
from app.services.storage_service import get_object_storage, media_key_from_url, ObjectNotFoundError
from app.services.task_report_access_service import require_report_read
from app.services.user_scope import require_company_context


async def synchronize(db, user, task_id, expected_user_id, event_id, file, expected_company_id=None):
    if user.id != expected_user_id:
        raise HTTPException(403, "La cuenta ha cambiado. Vuelve a entrar con la cuenta que guardó esta foto.")
    company = require_company_context(user)
    if expected_company_id is not None and expected_company_id != company:
        raise HTTPException(403, "La empresa activa ha cambiado. Vuelve al espacio que guardó esta foto.")
    task = await tasks.get_task_item(db, company, task_id)
    if task is None:
        raise HTTPException(404, "Trabajo no encontrado")
    await require_report_read(db, user, task.location_id)
    if not task_assignment_service.is_user_assigned(task, user.id):
        raise HTTPException(403, "Solo puedes adjuntar fotos a tus trabajos asignados.")
    if task.status in {"requested", "rejected"}:
        raise HTTPException(409, "El trabajo todavía no admite partes de ejecución.")
    contents = await file.read(MAX_IMAGE_BYTES + 1)
    await asyncio.to_thread(validate_image, contents)
    await db.run_sync(lambda sync_db: offline_repo.lock_user(sync_db, user.id))
    existing = await reports.get_by_user_event(db, user.id, str(event_id))
    if existing:
        if existing.task_item_id != task_id or existing.reporter_company_id != company or existing.report_type != "photo":
            raise HTTPException(409, "Este identificador pertenece a otro reporte.")
        try:
            stored = await asyncio.to_thread(get_object_storage().get, existing.media_key)
        except (ObjectNotFoundError, ValueError, TypeError):
            raise HTTPException(409, "La foto registrada necesita una revisión antes de volver a sincronizar.") from None
        if hashlib.sha256(stored.contents).digest() != hashlib.sha256(contents).digest():
            raise HTTPException(409, "Este identificador ya contiene una foto diferente.")
        return await task_report_service.get_report_response(db, user, existing.id)
    staging_url = await asyncio.to_thread(store_image, contents, company_id=company, folder="worker-photo-staging")
    staging_key = media_key_from_url(staging_url)
    try:
        return await task_report_service.create_report(db, user, TaskReportCreate(
            task_item_id=task_id, client_event_id=event_id, report_type="photo", media_url=staging_url,
            file_name=(file.filename or "foto")[:255],
        ))
    finally:
        if staging_key:
            await asyncio.to_thread(get_object_storage().delete, staging_key)
