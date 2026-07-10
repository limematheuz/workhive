from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.repositories import location_template as location_template_repo
from app.repositories import template_task as template_task_repo
from app.models.location_template import LocationTemplate
from app.schemas.location_template import LocationTemplateCreate, LocationTemplateUpdate
def get_templates_by_location(
    db: Session,
    location_id: int,
    company_id: int | None,
    skip: int = 0,
    limit: int = 100,
) -> list[LocationTemplate]:
    return location_template_repo.get_template_by_location(
        db, location_id, company_id, skip, limit
    )


def get_location_template(
    db: Session,
    location_id: int,
    template_task_id: int,
    company_id: int | None,
) -> LocationTemplate:
    existing_location = location_template_repo.get_location_template(
        db, location_id, template_task_id, company_id
    )
    if not existing_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Location Template not found"
        )
    return existing_location


def assign_template_to_location(
    db: Session,
    location_id: int,
    location_data: LocationTemplateCreate,
    company_id: int | None,
) -> LocationTemplate:
    template = template_task_repo.get_template_task_by_id(
        db, location_data.template_task_id, company_id
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template Task not found",
        )
    existing = location_template_repo.get_location_template(
        db, location_id, location_data.template_task_id, company_id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Location Template is already assigned",
        )
    return location_template_repo.create_location_template(
        db, location_data, location_id
    )


def update_location_template(
    db: Session,
    location_id: int,
    template_id: int,
    location_data: LocationTemplateUpdate,
    company_id: int | None,
) -> LocationTemplate:
    existing = location_template_repo.get_location_template(
        db, location_id, template_id, company_id
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Location Template not found"
        )
    return location_template_repo.update_location_template(
        db, existing, location_data
    )


def remove_template_from_location(
    db: Session, location_id: int, template_id: int, company_id: int | None
) -> None:
    existing = location_template_repo.get_location_template(
        db, location_id, template_id, company_id
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Location Template not found"
        )
    return location_template_repo.delete_location_template(db, existing)
