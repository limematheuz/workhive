from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.quality_template import (
    QualityInspectionTemplateCreate,
    QualityInspectionTemplateResponse,
    QualityInspectionTemplateUpdate,
)
from app.services import audit_service, quality_template_service


router = APIRouter()


@router.get("/", response_model=list[QualityInspectionTemplateResponse])
def read_quality_templates(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return quality_template_service.list_templates(db, current_user)


@router.get("/{template_id}", response_model=QualityInspectionTemplateResponse)
def read_quality_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return quality_template_service.get_template(db, current_user, template_id)


@router.post("/", response_model=QualityInspectionTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_quality_template(
    payload: QualityInspectionTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    template = quality_template_service.create_template(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=template.company_id,
        action="quality_template.created",
        entity_type="quality_inspection_template",
        entity_id=template.id,
        request=request,
        details={"location_id": template.location_id, "item_count": len(template.items)},
    )
    return template


@router.patch("/{template_id}", response_model=QualityInspectionTemplateResponse)
def update_quality_template(
    template_id: int,
    payload: QualityInspectionTemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    template = quality_template_service.update_template(db, current_user, template_id, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=template.company_id,
        action="quality_template.updated",
        entity_type="quality_inspection_template",
        entity_id=template.id,
        request=request,
        details={"location_id": template.location_id, "item_count": len(template.items)},
    )
    return template
