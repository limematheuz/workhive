"""Location lookup for work assigned to a legacy viewer."""

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment


def list_legacy_viewer_location_ids(
    db: Session, *, company_id: int, user_id: int
) -> set[int]:
    return {
        location_id
        for (location_id,) in (
            db.query(TaskItem.location_id)
            .outerjoin(TaskAssignment, TaskAssignment.task_id == TaskItem.id)
            .filter(
                TaskItem.company_id == company_id,
                TaskItem.location_id.isnot(None),
                TaskItem.status.in_({"pending", "accepted", "progress", "review", "completed"}),
                or_(
                    TaskItem.user_id == user_id,
                    TaskAssignment.user_id == user_id,
                ),
            )
            .distinct()
            .all()
        )
    }
