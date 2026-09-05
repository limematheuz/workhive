from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.template_task import TemplateTask
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate
from app.repositories import template_task as template_task_repo
from app.repositories import location_template as location_template_repo


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
    return template_task_repo.create_template_task(
        db, template_task_data, company_id
    )


def update_template_task(
    db: Session,
    template_id: int,
    template_update: TemplateTaskUpdate,
    company_id: int,
) -> TemplateTask:
    db_template = template_task_repo.get_template_task_by_id(
        db, template_id, company_id
    )
    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template Task not found"
        )

    # A template is a recipe for future work. Existing tasks are immutable
    # snapshots of the scope that was agreed when they were created/accepted.
    return template_task_repo.update_template_task(
        db, db_template, template_update
    )


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
    template_task_repo.delete_template_task(db, db_template)
