from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.quality_complaint import (
    QualityComplaintCreate,
    QualityComplaintResponse,
    QualityComplaintUpdate,
)
from app.services import audit_service, quality_complaint_service


router = APIRouter()


@router.get("/", response_model=list[QualityComplaintResponse])
def read_quality_complaints(db: Session = Depends(get_db), current_user: User = ActiveUser):
    return quality_complaint_service.list_complaints(db, current_user)


@router.get("/{complaint_id}", response_model=QualityComplaintResponse)
def read_quality_complaint(
    complaint_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser
):
    return quality_complaint_service.get_complaint(db, current_user, complaint_id)


@router.post("/", response_model=QualityComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_quality_complaint(
    payload: QualityComplaintCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    complaint = quality_complaint_service.create_complaint(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=complaint.company_id,
        action="quality_complaint.created",
        entity_type="quality_complaint",
        entity_id=complaint.id,
        request=request,
        details={"location_id": complaint.location_id, "client_id": complaint.client_id, "source": complaint.source},
    )
    return complaint


@router.patch("/{complaint_id}", response_model=QualityComplaintResponse)
def update_quality_complaint(
    complaint_id: int,
    payload: QualityComplaintUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    complaint = quality_complaint_service.update_complaint(db, current_user, complaint_id, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=complaint.company_id,
        action="quality_complaint.updated",
        entity_type="quality_complaint",
        entity_id=complaint.id,
        request=request,
        details={"location_id": complaint.location_id, "status": complaint.status},
    )
    return complaint
