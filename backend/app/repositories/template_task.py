from sqlalchemy.orm import Session
from app.models.template_task import TemplateTask
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate


def get_template_task_by_id(
    db: Session, template_id: int, company_id: int | None
) -> TemplateTask | None:
    query = db.query(TemplateTask).filter(TemplateTask.id == template_id)
    if company_id is not None:
        query = query.filter(TemplateTask.company_id == company_id)
    return query.first()


def get_all_template_tasks(
    db: Session, company_id: int | None, skip: int = 0, limit: int = 100
) -> list[TemplateTask]:
    query = db.query(TemplateTask).filter(TemplateTask.is_active.is_(True))
    if company_id is not None:
        query = query.filter(TemplateTask.company_id == company_id)
    return query.offset(skip).limit(limit).all()


def get_template_task_by_name(
    db: Session, name: str, company_id: int
) -> TemplateTask | None:
    return (
        db.query(TemplateTask)
        .filter(
            TemplateTask.name == name,
            TemplateTask.company_id == company_id,
        )
        .first()
    )


def create_template_task(
    db: Session, template_data: TemplateTaskCreate, company_id: int
) -> TemplateTask:
    db_template = TemplateTask(
        **template_data.model_dump(),
        company_id=company_id,
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def update_template_task(
    db: Session, db_template: TemplateTask, template_data: TemplateTaskUpdate
) -> TemplateTask:
    update_template = template_data.model_dump(exclude_unset=True)
    for key, value in update_template.items():
        setattr(db_template, key, value)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def delete_template_task(db: Session, db_template: TemplateTask) -> None:
    """Soft-delete: marca la plantilla como inactiva para no romper FK con tareas existentes."""
    db_template.is_active = False
    db.add(db_template)
    db.commit()
