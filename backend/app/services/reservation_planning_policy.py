"""Distinguish metadata edits from effective reservation planning changes."""

from app.core.datetime import as_utc
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.schemas.reservation import ReservationUpdate


_PLANNING_FIELDS = {
    "check_in_at", "check_out_at", "guest_count", "status",
    "cleaning_required", "assigned_company_id", "cleaning_scheduled_at",
}


def changes_cleaning_plan(
    reservation: Reservation, data: ReservationUpdate, task: TaskItem | None
) -> bool:
    for field in _PLANNING_FIELDS & data.model_fields_set:
        current = getattr(reservation, field)
        proposed = getattr(data, field)
        # The operational task owns the accepted schedule exposed by the API.
        if field == "cleaning_scheduled_at" and task is not None:
            current = task.scheduled_start_at
        if field.endswith("_at"):
            current, proposed = as_utc(current), as_utc(proposed)
        if current != proposed:
            return True
    return False
