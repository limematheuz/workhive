from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.template_task import TemplateTask
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate
from app.repositories import template_task as template_task_repo
from app.repositories import location_template as location_template_repo


def get_template_tasks(
    db: Session, company_id: int | None, skip: int = 0, limit: int = 100
) -> list[TemplateTask]:
    return template_task_repo.get_all_template_tasks(db, company_id, skip, limit)


def get_template_task(
    db: Session, template_id: int, company_id: int | None
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
    db: Session, template_task_data: TemplateTaskCreate, company_id: int | None
) -> TemplateTask:
    if company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A company is required to create templates",
        )
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
    company_id: int | None,
) -> TemplateTask:
    db_template = template_task_repo.get_template_task_by_id(
        db, template_id, company_id
    )
    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template Task not found"
        )

    updated_template = template_task_repo.update_template_task(db, db_template, template_update)

    # Propagate description/checklist changes to active uninvoiced tasks
    if template_update.description is not None:
        import re
        from app.models.task_item import TaskItem

        active_tasks = db.query(TaskItem).filter(
            TaskItem.template_task_id == template_id,
            TaskItem.status != "completed",
            TaskItem.is_invoiced.is_(False)
        ).all()

        new_desc = template_update.description or ""
        new_lines = new_desc.split("\n")
        new_questions = []
        for line in new_lines:
            match = re.match(r"^\s*[-*]?\s*\[\s*[xX\s]?\s*\]\s*(.+)$", line)
            if match:
                new_questions.append(match.group(1).strip())

        for task in active_tasks:
            if not task.description:
                task.description = new_desc
                continue

            # Find which elements were already marked as completed
            checked_questions = set()
            current_lines = task.description.split("\n")
            for line in current_lines:
                match = re.match(r"^\s*[-*]?\s*\[\s*([xX])\s*\]\s*(.+)$", line)
                if match:
                    checked_questions.add(match.group(2).strip())

            # Rebuild description based on new template items
            updated_lines = []
            for q in new_questions:
                box = "x" if q in checked_questions else " "
                updated_lines.append(f"- [{box}] {q}")

            task.description = "\n".join(updated_lines)

        db.commit()

    return updated_template


def delete_template_task(
    db: Session, template_id: int, company_id: int | None
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
