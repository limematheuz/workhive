"""SQL scope for persisted assignments, with a legacy direct-assignee fallback."""

from sqlalchemy import and_, or_

from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment


def assigned_task_condition(user_id: int):
    return or_(
        TaskItem.assignments.any(TaskAssignment.user_id == user_id),
        and_(~TaskItem.assignments.any(), TaskItem.user_id == user_id),
    )
