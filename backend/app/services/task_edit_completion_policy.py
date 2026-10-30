"""Validate edited checklist snapshots against retained structured requirements."""

from datetime import datetime, timezone

from fastapi import HTTPException

from app.models.task_item import TaskItem
from app.schemas.task_item import TaskItemUpdate
from app.services import task_assignment_service


def normalize_task_completion(
    task: TaskItem, task_data: TaskItemUpdate
) -> TaskItemUpdate:
    if task_data.status == "completed":
        description_changed = (
            "description" in task_data.model_fields_set
            and task_data.description != task.description
        )
        description = task_data.description if description_changed else task.description
        evidence = (
            task_data.checklist_evidence
            if "checklist_evidence" in task_data.model_fields_set
            else task.checklist_evidence
        ) or {}
        parsed = task_assignment_service.parse_checklist(description)
        has_checklist = bool(parsed or task.checklist_items)
        if description_changed:
            # Space requirements have no line in the incoming text. Their
            # stored answers remain authoritative when that text is edited.
            retained = [
                item for item in task.checklist_items if item.source_line_index is None
            ]
            retained_complete = all(
                item.completed
                or (evidence.get(f"item_{item.id}") or {}).get("answer")
                in {"yes", "no"}
                for item in retained
            )
            text_complete = task_assignment_service.checklist_snapshot_is_complete(
                description, evidence
            )
            checklist_complete = retained_complete and (
                text_complete if parsed else bool(retained)
            )
        else:
            checklist_complete = (
                task_assignment_service.all_task_checklist_items_are_complete(task)
            )
        if has_checklist and not checklist_complete:
            raise HTTPException(
                status_code=409,
                detail="Complete every checklist item before completing the task",
            )
        completed_at = (
            getattr(task, "date_done", None) if task.status == "completed" else None
        )
        return task_data.model_copy(
            update={"date_done": completed_at or datetime.now(timezone.utc)}
        )
    if "status" in task_data.model_fields_set and task.status == "completed":
        return task_data.model_copy(update={"date_done": None})
    return task_data
