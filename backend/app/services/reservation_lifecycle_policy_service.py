"""Business rules that protect reservation-linked work from unsafe changes.

The reservation service remains responsible for persistence and synchronization.
Keeping these checks together makes every destructive reservation operation use
the same invoicing and work-progress boundary.
"""

from fastapi import HTTPException, status

from app.models.task_item import TaskItem


_REASSIGNABLE_TASK_STATUSES = {"requested", "rejected", "pending"}


def linked_work_has_started(task: TaskItem, *, has_persisted_activity: bool = False) -> bool:
    return (
        task.status in {"progress", "review", "completed"}
        or task.date_done is not None
        or task.pricing_locked_at is not None
        or task.worked_seconds_snapshot is not None
        or any(item.completed for item in task.checklist_items)
        or any(assignment.status in {"progress", "completed"} for assignment in task.assignments)
        or bool(task.checklist_evidence)
        or bool(task.operational_notes)
        or bool(task.attachments)
        or bool(task.reported_issues)
        or has_persisted_activity
    )


def require_provider_change_allowed(
    task: TaskItem | None, *, has_persisted_activity: bool = False
) -> None:
    """A provider can only change before its linked work is accepted or billed."""
    if task is None:
        return
    if (
        task.is_invoiced
        or task.status not in _REASSIGNABLE_TASK_STATUSES
        or linked_work_has_started(task, has_persisted_activity=has_persisted_activity)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The service provider cannot be changed after the work "
                "has been accepted or started."
            ),
        )


def require_linked_work_removable(
    task: TaskItem | None,
    *,
    operation: str,
    has_persisted_activity: bool = False,
) -> None:
    """Keep invoiced work, and block deletion of work that already started."""
    if task is None:
        return
    detail_by_operation = {
        "cancel": "Reservations linked to invoiced work cannot be cancelled.",
        "delete": "Reservations linked to invoiced work cannot be deleted.",
        "disable_cleaning": "Cleaning cannot be disabled after its work was invoiced.",
    }
    if task.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail_by_operation[operation],
        )
    if operation != "cancel" and linked_work_has_started(
        task, has_persisted_activity=has_persisted_activity
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Work that has started must be preserved with its reservation.",
        )


def require_all_linked_work_removable(
    tasks: list[TaskItem],
    *,
    operation: str,
    task_ids_with_activity: set[int] | None = None,
) -> None:
    """Apply the same work-history protection to every reservation task."""
    for task in tasks:
        require_linked_work_removable(
            task,
            operation=operation,
            has_persisted_activity=task.id in (task_ids_with_activity or set()),
        )
