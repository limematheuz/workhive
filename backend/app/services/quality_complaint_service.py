"""Customer complaint workflow and its internal handling boundary."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_portal_grant import ClientPortalGrant
from app.models.quality_complaint import QualityComplaint
from app.models.user import User
from app.repositories import quality_complaint as complaint_repo
from app.schemas.quality_complaint import (
    QualityComplaintCreate,
    QualityComplaintResponse,
    QualityComplaintUpdate,
)
from app.services import location_access_service
from app.services.entitlement_service import company_feature_enabled, require_company_feature
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context


READ_CAPABILITY = "quality.complaints.read"
MANAGE_CAPABILITY = "quality.complaints.manage"


def _require_quality(company_id: int, db: Session) -> None:
    require_company_feature(db, company_id=company_id, code="features.quality")


def _require_location_access(db: Session, current_user: User, location_id: int, capability: str) -> None:
    location_access_service.require_location_capability(
        db,
        current_user,
        location_id,
        "can_manage_tasks",
        permission_code=capability,
    )


def _get_complaint(
    db: Session, company_id: int, complaint_id: int, *, for_update: bool = False
) -> QualityComplaint:
    complaint = complaint_repo.get_complaint(
        db, company_id=company_id, complaint_id=complaint_id, for_update=for_update
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reclamación no encontrada")
    return complaint


def _require_client_location(location) -> None:
    if location.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La reclamación debe estar vinculada a una ubicación de cliente",
        )


def list_complaints(db: Session, current_user: User) -> list[QualityComplaint]:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    return complaint_repo.list_complaints(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, READ_CAPABILITY),
    )


def get_complaint(db: Session, current_user: User, complaint_id: int) -> QualityComplaint:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    complaint = _get_complaint(db, company_id, complaint_id)
    _require_location_access(db, current_user, complaint.location_id, READ_CAPABILITY)
    return complaint


def create_complaint(
    db: Session, current_user: User, payload: QualityComplaintCreate
) -> QualityComplaint:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    location = location_access_service.require_location_capability(
        db,
        current_user,
        payload.location_id,
        "can_manage_tasks",
        permission_code=MANAGE_CAPABILITY,
    )
    if location.managing_company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")
    _require_client_location(location)
    complaint = QualityComplaint(
        company_id=company_id,
        client_id=location.client_id,
        location_id=location.id,
        submitted_by_user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        source="internal",
    )
    db.add(complaint)
    db.commit()
    return _get_complaint(db, company_id, complaint.id)


def update_complaint(
    db: Session,
    current_user: User,
    complaint_id: int,
    payload: QualityComplaintUpdate,
) -> QualityComplaint:
    company_id = require_company_context(current_user)
    _require_quality(company_id, db)
    complaint = _get_complaint(db, company_id, complaint_id, for_update=True)
    _require_location_access(db, current_user, complaint.location_id, MANAGE_CAPABILITY)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(complaint, key, value)
    if complaint.status in {"resolved", "closed"} and complaint.resolved_at is None:
        complaint.resolved_at = datetime.now(timezone.utc)
        complaint.resolved_by_user_id = current_user.id
    if complaint.status in {"submitted", "in_review"}:
        complaint.resolved_at = None
        complaint.resolved_by_user_id = None
    db.commit()
    return _get_complaint(db, company_id, complaint.id)


def _portal_response(complaint: QualityComplaint) -> dict:
    return {
        "id": complaint.id,
        "location_id": complaint.location_id,
        "location_name": complaint.location.name if complaint.location else "Ubicación",
        "title": complaint.title,
        "description": complaint.description,
        "category": complaint.category,
        "status": complaint.status,
        "customer_response": complaint.customer_response,
        "created_at": complaint.created_at,
        "updated_at": complaint.updated_at,
        "resolved_at": complaint.resolved_at,
    }


def list_client_portal_complaints(db: Session, *, grant: ClientPortalGrant) -> list[dict]:
    if not company_feature_enabled(db, company_id=grant.company_id, code="features.quality"):
        return []
    return [
        _portal_response(complaint)
        for complaint in complaint_repo.list_for_client_portal(
            db, company_id=grant.company_id, client_id=grant.client_id
        )
    ]


def list_client_portal_locations(db: Session, *, grant: ClientPortalGrant) -> list[dict]:
    if not company_feature_enabled(db, company_id=grant.company_id, code="features.quality"):
        return []
    return [
        {"id": location.id, "name": location.name}
        for location in complaint_repo.list_locations_for_client_portal(
            db, company_id=grant.company_id, client_id=grant.client_id
        )
    ]


def create_client_portal_complaint(
    db: Session,
    *,
    grant: ClientPortalGrant,
    current_user: User,
    payload: QualityComplaintCreate,
) -> dict:
    _require_quality(grant.company_id, db)
    location = complaint_repo.get_location_for_client_portal(
        db,
        company_id=grant.company_id,
        client_id=grant.client_id,
        location_id=payload.location_id,
    )
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")
    complaint = QualityComplaint(
        company_id=grant.company_id,
        client_id=grant.client_id,
        location_id=location.id,
        client_portal_grant_id=grant.id,
        submitted_by_user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        source="client_portal",
    )
    db.add(complaint)
    db.commit()
    stored = complaint_repo.get_complaint(
        db, company_id=grant.company_id, complaint_id=complaint.id
    )
    return _portal_response(stored or complaint)


def serialize_complaint(complaint: QualityComplaint) -> QualityComplaintResponse:
    return QualityComplaintResponse.model_validate(complaint)
