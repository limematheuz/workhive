"""Customer acknowledgement of a completed quality inspection.

This deliberately records an authenticated portal acceptance, not a qualified
electronic signature. The immutable digest binds the acknowledgement to the
customer-visible inspection summary without exposing internal notes or media.
"""

from hashlib import sha256
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_portal_grant import ClientPortalGrant
from app.models.quality_inspection import (
    QualityInspection,
    QualityInspectionClientAcceptance,
)
from app.models.user import User
from app.repositories import quality_inspection as inspection_repo
from app.schemas.client_portal import (
    ClientPortalInspectionAcceptanceCreate,
    ClientPortalInspectionAcceptanceResponse,
    ClientPortalInspectionItemResponse,
    ClientPortalInspectionResponse,
)
from app.services.entitlement_service import company_feature_enabled, require_company_feature


CLIENT_ACCEPTANCE_STATEMENT_VERSION = "quality-client-acceptance-v1"


def _require_quality(grant: ClientPortalGrant, db: Session) -> None:
    require_company_feature(db, company_id=grant.company_id, code="features.quality")


def _response(inspection: QualityInspection) -> ClientPortalInspectionResponse:
    acceptance = inspection.client_acceptance
    return ClientPortalInspectionResponse(
        id=inspection.id,
        template_title=inspection.template_title,
        location_name=inspection.location.name if inspection.location else "Ubicación",
        completed_at=inspection.completed_at,
        score=sum(item.points_awarded for item in inspection.items),
        max_score=sum(item.max_points for item in inspection.items),
        items=[
            ClientPortalInspectionItemResponse(
                title=item.title,
                status=item.status,
                points_awarded=item.points_awarded,
                max_points=item.max_points,
            )
            for item in inspection.items
        ],
        acceptance=(
            ClientPortalInspectionAcceptanceResponse(
                signer_name=acceptance.signer_name,
                statement_version=acceptance.statement_version,
                signed_at=acceptance.signed_at,
            )
            if acceptance is not None
            else None
        ),
    )


def _content_digest(inspection: QualityInspection) -> str:
    """Hash the exact summary rendered to the customer before acceptance."""

    customer_visible = {
        "completed_at": inspection.completed_at.isoformat() if inspection.completed_at else None,
        "inspection_id": inspection.id,
        "items": [
            {
                "max_points": item.max_points,
                "points_awarded": item.points_awarded,
                "status": item.status,
                "title": item.title,
            }
            for item in inspection.items
        ],
        "location_name": inspection.location.name if inspection.location else None,
        "max_score": sum(item.max_points for item in inspection.items),
        "score": sum(item.points_awarded for item in inspection.items),
        "template_title": inspection.template_title,
    }
    encoded = json.dumps(
        customer_visible,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return sha256(encoded).hexdigest()


def list_client_portal_inspections(
    db: Session,
    *,
    grant: ClientPortalGrant,
) -> list[ClientPortalInspectionResponse]:
    if not company_feature_enabled(
        db, company_id=grant.company_id, code="features.quality"
    ):
        return []
    inspections = inspection_repo.list_completed_for_client_portal(
        db,
        company_id=grant.company_id,
        client_id=grant.client_id,
    )
    return [_response(inspection) for inspection in inspections]


def accept_client_portal_inspection(
    db: Session,
    *,
    grant: ClientPortalGrant,
    current_user: User,
    inspection_id: int,
    payload: ClientPortalInspectionAcceptanceCreate,
) -> ClientPortalInspectionResponse:
    _require_quality(grant, db)
    inspection = inspection_repo.get_completed_for_client_portal(
        db,
        company_id=grant.company_id,
        client_id=grant.client_id,
        inspection_id=inspection_id,
        for_update=True,
    )
    if inspection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")
    if not payload.confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Debes confirmar la aceptación antes de continuar",
        )
    if inspection.client_acceptance is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La aceptación del cliente ya está registrada",
        )
    inspection.client_acceptance = QualityInspectionClientAcceptance(
        client_portal_grant_id=grant.id,
        signed_by_user_id=current_user.id,
        signer_name=payload.signer_name,
        signer_email=current_user.email.lower(),
        statement_version=CLIENT_ACCEPTANCE_STATEMENT_VERSION,
        content_digest=_content_digest(inspection),
    )
    db.commit()
    stored = inspection_repo.get_completed_for_client_portal(
        db,
        company_id=grant.company_id,
        client_id=grant.client_id,
        inspection_id=inspection.id,
    )
    return _response(stored or inspection)
