"""Apply a manager's structured checklist draft inside the task update transaction."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistAssignment
from app.models.user import User
from app.repositories import task_item as task_repo
from app.schemas.task_item import TaskChecklistEdit, TaskItemUpdate
from app.services import task_structure_service, task_update_policy_service


def apply_checklist_edits(
    db: Session,
    task: TaskItem,
    current_user: User,
    edits: list[TaskChecklistEdit],
) -> bool:
    if not edits:
        return False
    # Reuse the same scoped manager policy as the surrounding task update.
    task_update_policy_service.validate_task_update_scope(
        db,
        task,
        current_user,
        TaskItemUpdate(checklist_updates=edits),
    )
    loaded = task_repo.get_task_with_structure(db, current_user.company_id, task.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Task Item not found")
    items = {item.id: item for item in loaded.checklist_items}
    assignee_ids: set[int] = set()
    for edit in edits:
        item = items.get(edit.id)
        if item is None:
            raise HTTPException(status_code=404, detail="Checklist item not found")
        if item.source_line_index is not None:
            raise HTTPException(
                status_code=400, detail="This checklist item belongs to the description"
            )
        assignee_ids.update(edit.assigned_user_ids or [])
    task_structure_service.validate_assignee_ids(db, task.company_id, assignee_ids)

    evidence = dict(task.checklist_evidence or {})
    for edit in edits:
        item = items[edit.id]
        if edit.assigned_user_ids is not None:
            existing = {
                assignment.user_id: assignment for assignment in item.assignments
            }
            item.assignments[:] = [
                existing.get(user_id)
                or TaskChecklistAssignment(
                    user_id=user_id,
                    status="completed" if item.completed else "pending",
                )
                for user_id in edit.assigned_user_ids
            ]
        if edit.completed is not None:
            item.completed = edit.completed
            for assignment in item.assignments:
                assignment.status = "completed" if edit.completed else "pending"
            key = f"item_{item.id}"
            evidence[key] = {
                **(evidence.get(key) or {}),
                "answer": "yes" if edit.completed else None,
            }
    task.checklist_evidence = evidence
    return True
