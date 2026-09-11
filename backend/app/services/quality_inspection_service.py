from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.quality_inspection import QualityInspection, QualityInspectionItem
from app.models.user import User
from app.repositories import quality_inspection as inspection_repo
from app.repositories import quality_template as template_repo
from app.schemas.quality_inspection import (
    QualityInspectionCreate,
    QualityInspectionItemResponse,
    QualityInspectionResponse,
    QualityInspectionReview,
)
from app.services import location_access_service
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context


READ_CAPABILITY = "quality.inspections.read"
MANAGE_CAPABILITY = "quality.inspections.manage"


def _response(inspection: QualityInspection) -> QualityInspectionResponse:
    return QualityInspectionResponse(
        id=inspection.id,
        location_id=inspection.location_id,
        template_id=inspection.template_id,
        template_title=inspection.template_title,
        status=inspection.status,
        notes=inspection.notes,
        created_at=inspection.created_at,
        completed_at=inspection.completed_at,
        score=sum(item.points_awarded for item in inspection.items),
        max_score=sum(item.max_points for item in inspection.items),
        items=[QualityInspectionItemResponse.model_validate(item) for item in inspection.items],
    )


def _require_location_access(
    db: Session,
    current_user: User,
    location_id: int,
    capability: str,
) -> None:
    location_access_service.require_location_capability(
        db,
        current_user,
        location_id,
        "can_manage_tasks",
        permission_code=capability,
    )


def list_inspections(db: Session, current_user: User) -> list[QualityInspectionResponse]:
    company_id = require_company_context(current_user)
    inspections = inspection_repo.list_inspections(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, READ_CAPABILITY),
    )
    return [_response(inspection) for inspection in inspections]


def get_inspection(
    db: Session,
    current_user: User,
    inspection_id: int,
) -> QualityInspectionResponse:
    company_id = require_company_context(current_user)
    inspection = inspection_repo.get_inspection(
        db, company_id=company_id, inspection_id=inspection_id
    )
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")
    _require_location_access(db, current_user, inspection.location_id, READ_CAPABILITY)
    return _response(inspection)


def create_inspection(
    db: Session,
    current_user: User,
    payload: QualityInspectionCreate,
) -> QualityInspectionResponse:
    company_id = require_company_context(current_user)
    template = template_repo.get_template(
        db, company_id=company_id, template_id=payload.template_id
    )
    if template is None or not template.is_active:
        raise HTTPException(status_code=404, detail="Plantilla de inspección activa no encontrada")
    if template.location_id is not None and template.location_id != payload.location_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La plantilla solo se puede usar en su ubicación asignada",
        )
    _require_location_access(db, current_user, payload.location_id, MANAGE_CAPABILITY)
    inspection = QualityInspection(
        company_id=company_id,
        location_id=payload.location_id,
        template_id=template.id,
        template_title=template.title,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    inspection.items = [
        QualityInspectionItem(
            template_item_id=item.id,
            position=item.position,
            title=item.title,
            guidance=item.guidance,
            is_required=item.is_required,
            max_points=item.max_points,
        )
        for item in template.items
    ]
    db.add(inspection)
    db.commit()
    stored = inspection_repo.get_inspection(
        db, company_id=company_id, inspection_id=inspection.id
    )
    return _response(stored or inspection)


def complete_inspection(
    db: Session,
    current_user: User,
    inspection_id: int,
    payload: QualityInspectionReview,
) -> QualityInspectionResponse:
    company_id = require_company_context(current_user)
    inspection = inspection_repo.get_inspection(
        db, company_id=company_id, inspection_id=inspection_id, for_update=True
    )
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")
    _require_location_access(db, current_user, inspection.location_id, MANAGE_CAPABILITY)
    if inspection.status == "completed":
        raise HTTPException(status_code=409, detail="La inspección ya está cerrada")
    updates = {item.id: item for item in payload.items}
    unknown_ids = set(updates).difference(item.id for item in inspection.items)
    if unknown_ids:
        raise HTTPException(status_code=422, detail="La inspección contiene puntos desconocidos")
    for item in inspection.items:
        update = updates.get(item.id)
        if update is None:
            continue
        if update.points_awarded > item.max_points:
            raise HTTPException(status_code=422, detail="La puntuación supera el máximo permitido")
        item.status = update.status
        item.points_awarded = update.points_awarded
        item.notes = update.notes
    pending_required = [item for item in inspection.items if item.is_required and item.status == "not_assessed"]
    if pending_required:
        raise HTTPException(
            status_code=422,
            detail="Completa todos los puntos obligatorios antes de cerrar la inspección",
        )
    inspection.notes = payload.notes if payload.notes is not None else inspection.notes
    inspection.status = "completed"
    inspection.completed_by_user_id = current_user.id
    inspection.completed_at = datetime.now(timezone.utc)
    db.commit()
    stored = inspection_repo.get_inspection(
        db, company_id=company_id, inspection_id=inspection.id
    )
    return _response(stored or inspection)
