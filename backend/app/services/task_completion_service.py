from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.services import task_billing_service


def apply_update_side_effects(
    db: Session,
    task: TaskItem,
    *,
    was_completed: bool,
) -> None:
    if not was_completed and task.status == "completed":
        completed_at = task.date_done or datetime.now(timezone.utc)
        task.date_done = completed_at
        task_billing_service.capture_completed_work_snapshot(
            db,
            task,
            completed_at=completed_at,
        )
        return
    if was_completed and task.status != "completed":
        task_billing_service.clear_work_snapshot_on_reopen(task)
