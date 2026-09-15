import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.quality_evidence import QualityEvidence
from app.models.user import User
from app.repositories import quality_evidence as evidence_repo
from app.repositories import quality_incident as incident_repo
from app.repositories import quality_inspection as inspection_repo
from app.schemas.quality_evidence import QualityEvidenceCreate, QualityEvidenceResponse
from app.services import location_access_service
from app.services.entitlement_service import require_company_feature
from app.services.image_service import MAX_IMAGE_BYTES, validate_image
from app.services.storage_service import ObjectNotFoundError, build_media_key, get_object_storage
from app.services.user_scope import require_company_context


logger = logging.getLogger(__name__)

INSPECTION_READ_CAPABILITY = "quality.inspections.read"
INSPECTION_MANAGE_CAPABILITY = "quality.inspections.manage"
INCIDENT_READ_CAPABILITY = "quality.incidents.read"
INCIDENT_MANAGE_CAPABILITY = "quality.incidents.manage"
MAX_QUALITY_EVIDENCE_BYTES = MAX_IMAGE_BYTES


def _require_quality(company_id: int, db: Session) -> None:
    require_company_feature(db, company_id=company_id, code="features.quality")


def _require_location_access(
    db: Session, current_user: User, location_id: int, capability: str
) -> None:
    location_access_service.require_location_capability(
        db,
        current_user,
        location_id,
        "can_manage_tasks",
        permission_code=capability,
    )


def _get_inspection(db: Session, company_id: int, inspection_id: int):
    inspection = inspection_repo.get_inspection(
        db, company_id=company_id, inspection_id=inspection_id
    )
    if inspection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")
    return inspection


def _get_incident(db: Session, company_id: int, incident_id: int):
    incident = incident_repo.get_incident(db, company_id=company_id, incident_id=incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidencia de calidad no encontrada",
        )
    return incident


def _response(evidence: QualityEvidence) -> QualityEvidenceResponse:
    return QualityEvidenceResponse.model_validate(evidence)


def _store_evidence(
    db: Session,
    current_user: User,
    *,
    company_id: int,
    location_id: int,
    contents: bytes,
    payload: QualityEvidenceCreate,
    inspection_id: int | None = None,
    incident_id: int | None = None,
) -> QualityEvidenceResponse:
    if len(contents) > MAX_QUALITY_EVIDENCE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="La foto de evidencia no puede superar 1 MB",
        )
    content_type, extension = validate_image(contents)
    storage_key = build_media_key(company_id, "quality-evidence", extension)
    storage = get_object_storage()
    storage.put(storage_key, contents, content_type)
    evidence = QualityEvidence(
        company_id=company_id,
        location_id=location_id,
        inspection_id=inspection_id,
        incident_id=incident_id,
        media_key=storage_key,
        file_name=payload.file_name,
        caption=payload.caption,
        created_by_user_id=current_user.id,
    )
    db.add(evidence)
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            storage.delete(storage_key)
        except Exception:  # pragma: no cover - best-effort cleanup
            logger.exception("Failed to clean up unlinked quality evidence %s", storage_key)
        raise
    return _response(evidence)


def create_inspection_evidence(
    db: Session,
    current_user: User,
    inspection_id: int,
    contents: bytes,
    payload: QualityEvidenceCreate,
) -> QualityEvidenceResponse:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    inspection = _get_inspection(db, company_id, inspection_id)
    _require_location_access(
        db, current_user, inspection.location_id, INSPECTION_MANAGE_CAPABILITY
    )
    return _store_evidence(
        db,
        current_user,
        company_id=company_id,
        location_id=inspection.location_id,
        inspection_id=inspection.id,
        contents=contents,
        payload=payload,
    )


def create_incident_evidence(
    db: Session,
    current_user: User,
    incident_id: int,
    contents: bytes,
    payload: QualityEvidenceCreate,
) -> QualityEvidenceResponse:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id)
    _require_location_access(
        db, current_user, incident.location_id, INCIDENT_MANAGE_CAPABILITY
    )
    return _store_evidence(
        db,
        current_user,
        company_id=company_id,
        location_id=incident.location_id,
        incident_id=incident.id,
        contents=contents,
        payload=payload,
    )


def get_inspection_evidence_media(
    db: Session,
    current_user: User,
    inspection_id: int,
    evidence_id: int,
):
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    inspection = _get_inspection(db, company_id, inspection_id)
    _require_location_access(
        db, current_user, inspection.location_id, INSPECTION_READ_CAPABILITY
    )
    evidence = evidence_repo.get_for_inspection(
        db,
        company_id=company_id,
        inspection_id=inspection.id,
        evidence_id=evidence_id,
    )
    if evidence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada")
    try:
        return get_object_storage().get(evidence.media_key)
    except ObjectNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada") from None


def get_incident_evidence_media(
    db: Session,
    current_user: User,
    incident_id: int,
    evidence_id: int,
):
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    incident = _get_incident(db, company_id, incident_id)
    _require_location_access(
        db, current_user, incident.location_id, INCIDENT_READ_CAPABILITY
    )
    evidence = evidence_repo.get_for_incident(
        db,
        company_id=company_id,
        incident_id=incident.id,
        evidence_id=evidence_id,
    )
    if evidence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada")
    try:
        return get_object_storage().get(evidence.media_key)
    except ObjectNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada") from None
