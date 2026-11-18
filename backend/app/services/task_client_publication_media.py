"""Private copies belong to a publication, independently from internal reports."""
from hashlib import sha256
from uuid import uuid4
import logging
from fastapi import HTTPException
from app.models.task_client_publication import TaskClientPublicationPhoto
from app.services.storage_service import get_object_storage, build_media_key, ObjectNotFoundError
from app.services.image_service import validate_image, MAX_IMAGE_BYTES

TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
logger = logging.getLogger(__name__)


def copy_selected(company, reports, created_keys):
    if len(reports) > 12:
        raise HTTPException(422, "Cada parte admite hasta 12 fotografías seleccionadas.")
    storage = get_object_storage()
    photos = []
    total = 0
    for index, report in enumerate(reports, 1):
        if report.report_type not in {"photo", "checklist_photo"} or not report.media_key.startswith(f"company/{company}/task-report/"):
            raise HTTPException(422, "La fotografía no pertenece al almacenamiento privado de este reporte.")
        try:
            stored = storage.get(report.media_key)
        except ObjectNotFoundError as error:
            raise HTTPException(422, "Una fotografía seleccionada ya no está disponible. Actualiza el parte.") from error
        detected_type, extension = validate_image(stored.contents)
        total += len(stored.contents)
        if detected_type != stored.content_type or detected_type not in TYPES or total > 12 * MAX_IMAGE_BYTES:
            raise HTTPException(422, "Selecciona hasta 12 imágenes válidas de un máximo de 1 MB cada una.")
        key = build_media_key(company, "client-work-publications", extension)
        created_keys.append(key)
        storage.put(key, stored.contents, stored.content_type)
        photos.append(TaskClientPublicationPhoto(id=str(uuid4()), source_report_id=report.id, media_key=key,
            content_type=stored.content_type, file_name=f"foto-{index}.{extension}", sha256=sha256(stored.contents).hexdigest(), byte_size=len(stored.contents)))
    return photos


def metadata(photos):
    return [dict(id=photo.id, file_name=photo.file_name, content_type=photo.content_type, sha256=photo.sha256, byte_size=photo.byte_size) for photo in photos]


def cleanup(keys):
    storage = get_object_storage()
    for key in keys:
        try:
            storage.delete(key)
        except Exception:
            logger.exception("Could not clean an uncommitted customer-publication copy")


def read(photo):
    try:
        stored = get_object_storage().get(photo.media_key)
    except ObjectNotFoundError as error:
        raise HTTPException(404, "La fotografía publicada no está disponible.") from error
    if stored.content_type != photo.content_type or sha256(stored.contents).hexdigest() != photo.sha256:
        raise HTTPException(409, "La fotografía no coincide con la revisión publicada.")
    return stored
