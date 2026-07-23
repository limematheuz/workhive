from sqlalchemy.orm import Session, selectinload
from app.models.location_template import LocationTemplate
from app.models.template_task import TemplateTask
from app.schemas.location_template import LocationTemplateCreate, LocationTemplateUpdate


def get_location_template(
    db: Session,
    location_id: int,
    template_task_id: int,
    company_id: int | None = None,
) -> LocationTemplate | None:
    query = (
        db.query(LocationTemplate)
        .options(selectinload(LocationTemplate.template))
        .join(TemplateTask)
        .filter(LocationTemplate.location_id == location_id)
        .filter(LocationTemplate.template_task_id == template_task_id)
        .filter(TemplateTask.is_active.is_(True))
    )
    if company_id is not None:
        query = query.filter(TemplateTask.company_id == company_id)
    return query.first()


def get_template_by_location(
    db: Session,
    location_id: int,
    company_id: int | None,
    skip: int = 0,
    limit: int = 100,
) -> list[LocationTemplate]:
    query = (
        db.query(LocationTemplate)
        .options(selectinload(LocationTemplate.template))
        .join(TemplateTask)
        .filter(LocationTemplate.location_id == location_id)
        .filter(TemplateTask.is_active.is_(True))
    )
    if company_id is not None:
        query = query.filter(TemplateTask.company_id == company_id)
    return query.offset(skip).limit(limit).all()


def create_location_template(
    db: Session, location_data: LocationTemplateCreate, location_id: int
) -> LocationTemplate:
    db_location = LocationTemplate(
        **location_data.model_dump(), location_id=location_id
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def delete_location_template(db: Session, db_location_data: LocationTemplate) -> None:
    db.delete(db_location_data)
    db.commit()


def unlink_template_from_locations(db: Session, template_task_id: int) -> None:
    """Remove live location assignments before a template is soft-deleted."""
    (
        db.query(LocationTemplate)
        .filter(LocationTemplate.template_task_id == template_task_id)
        .delete(synchronize_session=False)
    )


def update_location_template(
    db: Session,
    db_location_template: LocationTemplate,
    schema: LocationTemplateUpdate,
) -> LocationTemplate:
    update_data = schema.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_location_template, key, value)
    db.add(db_location_template)
    db.commit()
    db.refresh(db_location_template)
    return db_location_template
