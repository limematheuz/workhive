from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.quality_inspection import (
    QualityInspectionCreate,
    QualityInspectionResponse,
    QualityInspectionReview,
)
from app.schemas.quality_evidence import QualityEvidenceCreate, QualityEvidenceResponse
from app.services import audit_service, quality_evidence_service, quality_inspection_service
from app.services.image_service import MAX_IMAGE_BYTES


router = APIRouter()


def _evidence_payload(file: UploadFile, caption: str | None) -> QualityEvidenceCreate:
    if file.filename and len(file.filename.strip()) > 255:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El nombre del archivo es demasiado largo")
    return QualityEvidenceCreate(file_name=file.filename, caption=caption)


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


@router.post(
    "/{inspection_id}/evidence",
    response_model=QualityEvidenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quality_inspection_evidence(
    inspection_id: int,
    request: Request,
    file: UploadFile = File(...),
    caption: str | None = Form(default=None, max_length=1_000),
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    evidence = quality_evidence_service.create_inspection_evidence(
        db,
        current_user,
        inspection_id,
        file.file.read(MAX_IMAGE_BYTES + 1),
        _evidence_payload(file, caption),
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="quality_evidence.created",
        entity_type="quality_evidence",
        entity_id=evidence.id,
        request=request,
        details={"inspection_id": inspection_id},
    )
    return evidence


@router.get("/{inspection_id}/evidence/{evidence_id}/media")
def read_quality_inspection_evidence_media(
    inspection_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    stored = quality_evidence_service.get_inspection_evidence_media(
        db, current_user, inspection_id, evidence_id
    )
    return Response(
        content=stored.contents,
        media_type=stored.content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
