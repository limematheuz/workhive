"""Location-owned documents and equipment. Files stay in private object storage."""

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import PurePath
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location_document import LocationDocument
from app.models.location_equipment import LocationEquipment
from app.models.user import User
from app.repositories import location_assets as assets_repo
from app.schemas.location_assets import LocationEquipmentInput, LocationEquipmentUpdate
from app.core.config import settings
from app.services.storage_service import ObjectNotFoundError, build_document_key, get_object_storage
from app.services import location_service, organization_authorization_service
from app.services.user_scope import scoped_company_id


_FILE_TYPES = {
    "application/pdf": ("pdf", b"%PDF-"),
    "image/jpeg": ("jpg", b"\xff\xd8\xff"),
    "image/png": ("png", b"\x89PNG\r\n\x1a\n"),
}


def _validated_document(contents: bytes, content_type: str | None) -> tuple[str, str]:
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document file is empty")
    if len(contents) > settings.LOCATION_DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Document exceeds the configured file size limit",
        )
    detected = next((value for value in _FILE_TYPES.items() if contents.startswith(value[1][1])), None)
    if detected is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Only PDF, JPEG, and PNG documents are allowed")
    detected_type, (extension, _) = detected
    if content_type and content_type != detected_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Document content type does not match its file")
    return detected_type, extension


def _safe_name(filename: str | None, extension: str) -> str:
    name = PurePath((filename or "document").replace("\\", "/")).name.strip()
    name = re.sub(r"[^A-Za-z0-9._() -]", "_", name)
    if not name or name in {".", ".."}:
        name = f"document.{extension}"
    return name[:255]


def list_documents(db: Session, location_id: int) -> list[LocationDocument]:
    return assets_repo.list_documents(db, location_id)


def list_document_library(db: Session, current_user: User) -> list[tuple[LocationDocument, str]]:
    """List only documents attached to locations the current principal can read."""

    organization_authorization_service.require_capability(
        db, current_user, "locations.read"
    )
    permitted_ids = organization_authorization_service.permitted_location_ids(
        db, current_user, "locations.read"
    )
    locations = location_service.get_locations(
        db,
        scoped_company_id(current_user),
        skip=0,
        limit=10_000,
        location_ids=permitted_ids,
    )
    return assets_repo.list_documents_for_locations(
        db, {location.id for location in locations}
    )


def upload_document(
    db: Session,
    *,
    location_id: int,
    company_id: int,
    current_user: User,
    filename: str | None,
    content_type: str | None,
    contents: bytes,
    document_type: str,
) -> LocationDocument:
    normalized_type = document_type.strip().lower() or "other"
    if len(normalized_type) > 40:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Document type is too long")
    stored_content_type, extension = _validated_document(contents, content_type)
    used_bytes = assets_repo.active_document_bytes_for_company_locked(db, company_id)
    if used_bytes + len(contents) > settings.LOCATION_DOCUMENT_COMPANY_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your company has reached its document storage limit",
            headers={"X-WorkHive-Error-Code": "location_documents.storage_limit_reached"},
        )
    storage_key = build_document_key(company_id, f"locations/{location_id}", extension)
    storage = get_object_storage()
    try:
        storage.put(storage_key, contents, stored_content_type)
    except Exception:
        raise
    document = LocationDocument(
        company_id=company_id,
        location_id=location_id,
        name=_safe_name(filename, extension),
        document_type=normalized_type,
        storage_key=storage_key,
        content_type=stored_content_type,
        size_bytes=len(contents),
        sha256=sha256(contents).hexdigest(),
        created_by_user_id=current_user.id,
    )
    db.add(document)
    try:
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        try:
            storage.delete(storage_key)
        except Exception:
            pass
        raise
    return document


def get_document_contents(db: Session, location_id: int, document_id: int) -> tuple[LocationDocument, bytes]:
    document = assets_repo.get_document(db, location_id, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location document not found")
    try:
        return document, get_object_storage().get(document.storage_key).contents
    except ObjectNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location document file not found") from None


def archive_document(db: Session, location_id: int, document_id: int) -> None:
    document = assets_repo.get_document(db, location_id, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location document not found")
    document.archived_at = datetime.now(timezone.utc)
    db.add(document)
    db.commit()


def list_equipment(db: Session, location_id: int) -> list[LocationEquipment]:
    return assets_repo.list_equipment(db, location_id)


def list_equipment_library(db: Session, current_user: User) -> list[tuple[LocationEquipment, str]]:
    organization_authorization_service.require_capability(
        db, current_user, "locations.read"
    )
    permitted_ids = organization_authorization_service.permitted_location_ids(
        db, current_user, "locations.read"
    )
    locations = location_service.get_locations(
        db,
        scoped_company_id(current_user),
        skip=0,
        limit=10_000,
        location_ids=permitted_ids,
    )
    return assets_repo.list_equipment_for_locations(
        db, {location.id for location in locations}
    )


def create_equipment(db: Session, *, location_id: int, company_id: int, data: LocationEquipmentInput) -> LocationEquipment:
    equipment = LocationEquipment(location_id=location_id, company_id=company_id, **data.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


def update_equipment(db: Session, *, location_id: int, equipment_id: int, data: LocationEquipmentUpdate) -> LocationEquipment:
    equipment = assets_repo.get_equipment(db, location_id, equipment_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location equipment not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(equipment, field, value)
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


def archive_equipment(db: Session, location_id: int, equipment_id: int) -> None:
    equipment = assets_repo.get_equipment(db, location_id, equipment_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location equipment not found")
    equipment.is_active = False
    db.add(equipment)
    db.commit()
