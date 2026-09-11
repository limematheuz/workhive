"""Task completion and work-session state transitions."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo
from app.services import (
    calendar_sync_service,
    task_assignment_service,
    task_billing_service,
    task_lifecycle_notification_service,
    task_structure_service,
)
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import require_capability
from app.services.task_item_read_service import get_task_item
from app.services.work_session_pause_service import close_open_pause


def require_work_orders_feature(db: Session, current_user: User) -> None:
    if current_user.company_id is not None:
        require_company_feature(
            db,
            company_id=current_user.company_id,
            code="features.work_orders",
        )


def mark_task_completed(
    db: Session,
    task: TaskItem,
    *,
    completed_at: datetime | None = None,
) -> datetime:
    stamped_at = completed_at or datetime.now(timezone.utc)
    task_billing_service.lock_task_pricing(task, locked_at=stamped_at)
    task.status = "completed"
    task.date_done = stamped_at
    task_billing_service.capture_completed_work_snapshot(
        db,
        task,
        completed_at=stamped_at,
    )
    return stamped_at


def complete_task_when_checklist_is_done(db: Session, task: TaskItem) -> bool:
    if task.status in {"requested", "rejected", "completed"}:
        return False
    if not task_assignment_service.all_task_checklist_items_are_complete(task):
        return False

    mark_task_completed(db, task)
    return True


def _require_finishable_user_assignment(task: TaskItem, user_id: int) -> None:
    if not task_assignment_service.is_user_assigned(task, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only finish work assigned to you",
        )
    if not task_assignment_service.user_checklist_is_complete(task, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete all your assigned checklist items before finishing",
        )


def _active_sessions_for_task(
    db: Session,
    user_id: int,
    task_id: int,
) -> list[WorkSession]:
    return [
        session
        for session in work_session_repo.get_active_sessions_by_user(db, user_id)
        if session.task_item_id == task_id
    ]


def _finish_without_active_session(task: TaskItem, user_id: int) -> TaskItem:
    assignment_status = task_assignment_service.get_user_assignment_status(task, user_id)
    if task.status == "completed" or assignment_status == "completed":
        return task
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="No active work session exists for this task",
    )


def _complete_user_assignment(task: TaskItem, user_id: int) -> None:
    updated_description, updated_count = task_assignment_service.set_user_assignment_status(
        task.description,
        user_id,
        "completed",
    )
    if updated_count:
        task.description = updated_description
    task_structure_service.set_user_status(task, user_id, "completed")


def _set_task_status_after_user_finish(db: Session, task: TaskItem) -> None:
    checklist_complete = task_assignment_service.all_task_checklist_items_are_complete(task)
    has_explicit_assignments = task_assignment_service.has_explicit_assignments(
        task.description
    )
    if checklist_complete or not has_explicit_assignments:
        mark_task_completed(db, task)
        return
    task.status = "progress"
    task.date_done = None
    task_billing_service.clear_work_snapshot_on_reopen(task)


def _close_user_task_sessions(
    db: Session,
    active_sessions: list[WorkSession],
    *,
    end_latitude: float | None = None,
    end_longitude: float | None = None,
    end_accuracy_meters: float | None = None,
) -> None:
    completed_at = datetime.now(timezone.utc)
    for index, active_session in enumerate(active_sessions):
        active_session.end_time = completed_at if index == 0 else active_session.start_time
        close_open_pause(db, active_session, active_session.end_time)
        if index == 0:
            active_session.end_latitude = end_latitude
            active_session.end_longitude = end_longitude
            active_session.end_accuracy_meters = end_accuracy_meters
        db.add(active_session)


def finish_task_work(
    db: Session,
    current_user: User,
    task_item_id: int,
    *,
    end_latitude: float | None = None,
    end_longitude: float | None = None,
    end_accuracy_meters: float | None = None,
) -> TaskItem:
    require_work_orders_feature(db, current_user)
    task = get_task_item(db, current_user, task_item_id)
    require_capability(
        db,
        current_user,
        "time.manage",
        scope_type="location",
        scope_id=task.location_id,
    )
    was_completed = task.status == "completed"
    _require_finishable_user_assignment(task, current_user.id)
    active_sessions = _active_sessions_for_task(db, current_user.id, task.id)
    if not active_sessions:
        return _finish_without_active_session(task, current_user.id)

    _complete_user_assignment(task, current_user.id)
    _close_user_task_sessions(
        db,
        active_sessions,
        end_latitude=end_latitude,
        end_longitude=end_longitude,
        end_accuracy_meters=end_accuracy_meters,
    )
    _set_task_status_after_user_finish(db, task)
    db.add(task)
    db.commit()
    db.refresh(task)
    calendar_sync_service.enqueue_task_sync(db, task)
    if not was_completed and task.status == "completed":
        task_lifecycle_notification_service.notify_task_completed(db, task)
    return task
