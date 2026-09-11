from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.quality_template import QualityInspectionTemplate, QualityInspectionTemplateItem
from app.models.user import User
from app.repositories import quality_template as quality_template_repo
from app.schemas.quality_template import QualityInspectionTemplateCreate, QualityInspectionTemplateUpdate
from app.services import location_access_service
from app.services.organization_authorization_service import permitted_location_ids, require_capability
from app.services.user_scope import require_company_context


READ_CAPABILITY = "quality.templates.read"
MANAGE_CAPABILITY = "quality.templates.manage"


def _replace_items(template: QualityInspectionTemplate, items) -> None:
    template.items[:] = [
        QualityInspectionTemplateItem(
            position=position,
            title=item.title,
            guidance=item.guidance,
            is_required=item.is_required,
            max_points=item.max_points,
        )
        for position, item in enumerate(items)
    ]


def _require_template_access(
    db: Session,
    current_user: User,
    template: QualityInspectionTemplate,
    capability: str,
) -> None:
    if template.location_id is None:
        require_capability(db, current_user, capability)
        return
    location_access_service.require_location_capability(
        db,
        current_user,
        template.location_id,
        "can_manage_tasks",
        permission_code=capability,
    )


def list_templates(db: Session, current_user: User) -> list[QualityInspectionTemplate]:
    company_id = require_company_context(current_user)
    return quality_template_repo.list_templates(
        db,
        company_id=company_id,
        location_ids=permitted_location_ids(db, current_user, READ_CAPABILITY),
    )


def get_template(
    db: Session,
    current_user: User,
    template_id: int,
) -> QualityInspectionTemplate:
    company_id = require_company_context(current_user)
    template = quality_template_repo.get_template(
        db, company_id=company_id, template_id=template_id
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Plantilla de inspección no encontrada")
    _require_template_access(db, current_user, template, READ_CAPABILITY)
    return template


def create_template(
    db: Session,
    current_user: User,
    payload: QualityInspectionTemplateCreate,
) -> QualityInspectionTemplate:
    company_id = require_company_context(current_user)
    if payload.location_id is None:
        require_capability(db, current_user, MANAGE_CAPABILITY)
    else:
        location_access_service.require_location_capability(
            db,
            current_user,
            payload.location_id,
            "can_manage_tasks",
            permission_code=MANAGE_CAPABILITY,
        )
    template = QualityInspectionTemplate(
        company_id=company_id,
        location_id=payload.location_id,
        title=payload.title,
        description=payload.description,
        created_by_user_id=current_user.id,
    )
    _replace_items(template, payload.items)
    db.add(template)
    db.commit()
    return quality_template_repo.get_template(
        db, company_id=company_id, template_id=template.id
    ) or template


def update_template(
    db: Session,
    current_user: User,
    template_id: int,
    payload: QualityInspectionTemplateUpdate,
) -> QualityInspectionTemplate:
    company_id = require_company_context(current_user)
    template = quality_template_repo.get_template(
        db, company_id=company_id, template_id=template_id, for_update=True
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Plantilla de inspección no encontrada")
    _require_template_access(db, current_user, template, MANAGE_CAPABILITY)
    changes = payload.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in changes.items():
        setattr(template, key, value)
    if payload.items is not None:
        _replace_items(template, payload.items)
    db.commit()
    return quality_template_repo.get_template(
        db, company_id=company_id, template_id=template.id
    ) or template
