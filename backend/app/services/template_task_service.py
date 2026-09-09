from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.template_task import TemplateTask
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate
from app.repositories import template_task as template_task_repo
from app.repositories import location_template as location_template_repo
from app.repositories import service_catalog_version as service_version_repo


def get_template_tasks(
    db: Session, company_id: int, skip: int = 0, limit: int = 100
) -> list[TemplateTask]:
    return template_task_repo.get_all_template_tasks(db, company_id, skip, limit)


def get_template_task(
    db: Session, template_id: int, company_id: int
) -> TemplateTask:
    template_task = template_task_repo.get_template_task_by_id(
        db, template_id, company_id
    )
    if not template_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template Task not found"
        )
    return template_task


def create_template_task(
    db: Session, template_task_data: TemplateTaskCreate, company_id: int
) -> TemplateTask:
    existing_template = template_task_repo.get_template_task_by_name(
        db, template_task_data.name, company_id
    )
    if existing_template:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Template Task already exists"
        )
    try:
        template = template_task_repo.create_template_task(
            db, template_task_data, company_id
        )
        service_version_repo.create_from_template(db, template)
        db.commit()
        db.refresh(template)
        return template
    except Exception:
        db.rollback()
        raise


def update_template_task(
    db: Session,
    template_id: int,
    template_update: TemplateTaskUpdate,
    company_id: int,
) -> TemplateTask:
    db_template = template_task_repo.get_template_task_by_id(
        db, template_id, company_id, for_update=True
    )
    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template Task not found"
        )

    requested_changes = template_update.model_dump(exclude_unset=True)
    changes = {
        field: value
        for field, value in requested_changes.items()
        if getattr(db_template, field) != value
    }
    if not changes:
        return db_template

    requested_name = changes.get("name")
    if requested_name and requested_name != db_template.name:
        existing_template = template_task_repo.get_template_task_by_name(
            db, requested_name, company_id
        )
        if existing_template and existing_template.id != db_template.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template Task already exists",
            )

    # A template is a recipe for future work. Existing tasks keep their own
    # operational and billing snapshots, while this catalog records the new
    # service definition as an immutable revision.
    try:
        db_template.catalog_version += 1
        updated_template = template_task_repo.update_template_task(
            db, db_template, TemplateTaskUpdate(**changes)
        )
        service_version_repo.create_from_template(db, updated_template)
        db.commit()
        db.refresh(updated_template)
        return updated_template
    except Exception:
        db.rollback()
        raise


def get_service_catalog_versions(
    db: Session,
    template_id: int,
    company_id: int,
):
    get_template_task(db, template_id, company_id)
    return service_version_repo.list_for_template(db, template_task_id=template_id)


def delete_template_task(
    db: Session, template_id: int, company_id: int
) -> None:
    db_template = template_task_repo.get_template_task_by_id(
        db, template_id, company_id
    )
    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template Task not found"
        )
    location_template_repo.unlink_template_from_locations(db, template_id)
    try:
        template_task_repo.delete_template_task(db, db_template)
        db.commit()
    except Exception:
        db.rollback()
        raise
