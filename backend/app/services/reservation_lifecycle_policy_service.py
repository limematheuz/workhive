"""Business rules that protect reservation-linked work from unsafe changes.

The reservation service remains responsible for persistence and synchronization.
Keeping these checks together makes every destructive reservation operation use
the same invoicing and work-progress boundary.
"""

from fastapi import HTTPException, status

from app.models.task_item import TaskItem


_REASSIGNABLE_TASK_STATUSES = {"requested", "rejected", "pending"}


def require_provider_change_allowed(task: TaskItem | None) -> None:
    """A provider can only change before its linked work is accepted or billed."""
    if task is None:
        return
    if task.is_invoiced or task.status not in _REASSIGNABLE_TASK_STATUSES:
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
) -> None:
    """Protect the fiscal link whenever a reservation operation removes work."""
    if task is None or not task.is_invoiced:
        return
    detail_by_operation = {
        "cancel": "Reservations linked to invoiced work cannot be cancelled.",
        "delete": "Reservations linked to invoiced work cannot be deleted.",
        "disable_cleaning": "Cleaning cannot be disabled after its work was invoiced.",
    }
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail_by_operation[operation],
    )


def require_all_linked_work_removable(
    tasks: list[TaskItem],
    *,
    operation: str,
) -> None:
    """Apply the same fiscal protection when deleting every reservation task."""
    if any(task.is_invoiced for task in tasks):
        require_linked_work_removable(
            next(task for task in tasks if task.is_invoiced),
            operation=operation,
        )
