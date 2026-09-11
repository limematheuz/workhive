from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.work_session import WorkSession
from app.models.work_session_pause import WorkSessionPause
from app.models.user import User
from app.schemas.work_session import WorkSessionCreate, WorkSessionEnd
from app.repositories import work_session as work_session_repo
from app.repositories import user as user_repo
from app.repositories import task_item as task_item_repo
from app.services import task_assignment_service
from app.services import task_structure_service
from app.services import task_item_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import require_capability
from app.services.work_session_pause_service import close_open_pause
from app.services.labor_cost_snapshot_service import refresh_work_session_labor_cost


def _require_manageable_active_session(
    db: Session,
    user_id: int,
    current_user: User | None,
) -> WorkSession:
    if current_user is not None:
        _require_time_tracking_feature(db, current_user.company_id)
        if current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage your own work session",
            )
    active_session = work_session_repo.get_active_session_by_user_for_update(db, user_id)
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found",
        )
    if current_user:
        require_capability(
            db,
            current_user,
            "time.manage",
            scope_type=(
                "location" if active_session.location_id is not None else "company"
            ),
            scope_id=active_session.location_id,
        )
    return active_session


def _require_time_tracking_feature(
    db: Session,
    company_id: int | None,
) -> None:
    if company_id is not None:
        require_company_feature(
            db,
            company_id=company_id,
            code="features.time_tracking",
        )


def _user_with_time_tracking(db: Session, user_id: int) -> User:
    db_user = user_repo.get_user_by_id(db, user_id)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    _require_time_tracking_feature(db, db_user.company_id)
    return db_user


def get_work_sessions(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    location_ids: set[int] | None = None,
) -> list[WorkSession]:
    _user_with_time_tracking(db, user_id)
    return work_session_repo.get_work_session_by_user(
        db,
        user_id,
        skip,
        limit,
        location_ids,
    )


def get_work_session(
    db: Session,
    session_id: int,
    user_id: int,
    location_ids: set[int] | None = None,
) -> WorkSession:
    _user_with_time_tracking(db, user_id)
    work_session = work_session_repo.get_work_session_by_id(
        db,
        session_id,
        user_id,
        location_ids,
    )
    if work_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Work Session not found"
        )
    return work_session


def get_active_session(db: Session, user_id: int) -> WorkSession | None:
    _user_with_time_tracking(db, user_id)
    return work_session_repo.get_active_session_by_user(db, user_id)


def start_work_session(
    db: Session, user_id: int, session_data: WorkSessionCreate
) -> WorkSession:
    db_user = _user_with_time_tracking(db, user_id)
    task = task_item_repo.get_task_item(
        db, db_user.company_id, session_data.task_item_id
    )
    if not task or task.location_id != session_data.location_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found at the selected location",
        )
    task_item_service.start_task_work(
        db,
        db_user,
        task.id,
        session_data.notes,
        session_data.start_latitude,
        session_data.start_longitude,
        session_data.start_accuracy_meters,
    )
    active_session = work_session_repo.get_active_session_by_user(db, user_id)
    if active_session is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The work session could not be created",
        )
    return active_session


def end_work_session(
    db: Session,
    user_id: int,
    *,
    current_user: User | None = None,
    end_data: WorkSessionEnd | None = None,
) -> WorkSession:
    active_session = _require_manageable_active_session(db, user_id, current_user)

    end_time = datetime.now(timezone.utc)
    db_user = user_repo.get_user_by_id(db, user_id)
    task = (
        task_item_repo.get_task_item(db, db_user.company_id, active_session.task_item_id)
        if db_user and active_session.task_item_id
        else None
    )

    close_open_pause(db, active_session, end_time)
    active_session.end_time = end_time
    if end_data is not None:
        active_session.end_latitude = end_data.end_latitude
        active_session.end_longitude = end_data.end_longitude
        active_session.end_accuracy_meters = end_data.end_accuracy_meters
    if task and db_user:
        personal_status = task_assignment_service.get_user_assignment_status(
            task, user_id
        )
        if personal_status == "progress":
            fallback_status = (
                "accepted"
                if db_user.role.name in {"admin", "manager", "superadmin"}
                else "pending"
            )
            updated_description, updated_count = (
                task_assignment_service.set_user_assignment_status(
                    task.description, user_id, fallback_status
                )
            )
            if updated_count:
                task.description = updated_description
            elif task.user_id == user_id and task.status == "progress":
                task.status = fallback_status
            task_structure_service.set_user_status(task, user_id, fallback_status)

        sessions = work_session_repo.get_sessions_by_task(db, task.id)
        has_other_active_worker = any(
            session.id != active_session.id and session.end_time is None
            for session in sessions
        )
        if (
            task.status == "progress"
            and not has_other_active_worker
            and not task_assignment_service.has_in_progress_assignment(task.description)
            and not task_assignment_service.all_task_checklist_items_are_complete(task)
        ):
            task.status = "accepted"
            task.date_done = None

        db.add(task)

    if db_user and db_user.company_id is not None:
        refresh_work_session_labor_cost(
            db,
            work_session=active_session,
            company_id=db_user.company_id,
        )
    db.add(active_session)
    db.commit()
    db.refresh(active_session)
    return active_session


def pause_work_session(
    db: Session,
    user_id: int,
    *,
    current_user: User | None = None,
) -> WorkSession:
    active_session = _require_manageable_active_session(db, user_id, current_user)
    if active_session.paused_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The work session is already paused",
        )

    paused_at = datetime.now(timezone.utc)
    active_session.paused_at = paused_at
    db.add(WorkSessionPause(work_session_id=active_session.id, started_at=paused_at))
    db.add(active_session)
    db.commit()
    db.refresh(active_session)
    return active_session


def resume_work_session(
    db: Session,
    user_id: int,
    *,
    current_user: User | None = None,
) -> WorkSession:
    active_session = _require_manageable_active_session(db, user_id, current_user)
    if active_session.paused_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The work session is not paused",
        )

    close_open_pause(db, active_session, datetime.now(timezone.utc))
    db.add(active_session)
    db.commit()
    db.refresh(active_session)
    return active_session


from app.services.work_session_summary_service import (  # noqa: E402,F401
    get_active_company_sessions,
    get_task_work_detailed_summaries,
    get_task_work_detailed_summary,
    get_task_work_summary,
)
