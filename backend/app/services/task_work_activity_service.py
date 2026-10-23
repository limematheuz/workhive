"""Detect task activity that must survive destructive reservation workflows."""

from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.repositories import task_item as task_item_repo
from app.repositories import work_session as work_session_repo
from app.services.reservation_lifecycle_policy_service import linked_work_has_started


def has_recorded_activity(db: Session, task: TaskItem) -> bool:
    return (
        linked_work_has_started(task)
        or work_session_repo.has_sessions_for_task(db, task.id)
        or task_item_repo.has_reports_for_task(db, task.id)
    )
