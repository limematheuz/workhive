from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.quality_inspection import (
    QualityInspectionCreate,
    QualityInspectionResponse,
    QualityInspectionReview,
)
from app.services import audit_service, quality_inspection_service


router = APIRouter()


@router.get("/", response_model=list[QualityInspectionResponse])
def read_quality_inspections(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return quality_inspection_service.list_inspections(db, current_user)


@router.get("/{inspection_id}", response_model=QualityInspectionResponse)
def read_quality_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return quality_inspection_service.get_inspection(db, current_user, inspection_id)


@router.post("/", response_model=QualityInspectionResponse, status_code=status.HTTP_201_CREATED)
def create_quality_inspection(
    payload: QualityInspectionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    inspection = quality_inspection_service.create_inspection(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="quality_inspection.created",
        entity_type="quality_inspection",
        entity_id=inspection.id,
        request=request,
        details={"location_id": inspection.location_id, "template_id": inspection.template_id},
    )
    return inspection


@router.post("/{inspection_id}/complete", response_model=QualityInspectionResponse)
def complete_quality_inspection(
    inspection_id: int,
    payload: QualityInspectionReview,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    inspection = quality_inspection_service.complete_inspection(
        db, current_user, inspection_id, payload
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="quality_inspection.completed",
        entity_type="quality_inspection",
        entity_id=inspection.id,
        request=request,
        details={"location_id": inspection.location_id, "score": inspection.score, "max_score": inspection.max_score},
    )
    return inspection
