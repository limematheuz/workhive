"""Remove linked work and retire its actionable prompts in the same transaction."""

from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.repositories import task_item as task_repo
from app.services.task_lifecycle_notification_service import reconcile_assignment_notifications


def remove_task(db: Session, task: TaskItem) -> None:
    reconcile_assignment_notifications(db, task, deleted=True)
    task_repo.delete_task_item(db, task)
