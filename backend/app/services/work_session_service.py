from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.work_session import WorkSession
from app.models.user import User
from app.schemas.work_session import WorkSessionCreate
from app.repositories import work_session as work_session_repo
from app.repositories import user as user_repo
from app.repositories import task_item as task_item_repo
from app.services import task_assignment_service
from app.services import task_structure_service
from app.services import task_item_service
from app.services.entitlement_service import require_company_feature


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
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> list[WorkSession]:
    _user_with_time_tracking(db, user_id)
    return work_session_repo.get_work_session_by_user(db, user_id, skip, limit)


def get_work_session(db: Session, session_id: int, user_id: int) -> WorkSession:
    _user_with_time_tracking(db, user_id)
    work_session = work_session_repo.get_work_session_by_id(db, session_id, user_id)
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


def end_work_session(db: Session, user_id: int) -> WorkSession:
    active_session = work_session_repo.get_active_session_by_user(db, user_id)
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found",
        )

    end_time = datetime.now(timezone.utc)
    db_user = user_repo.get_user_by_id(db, user_id)
    task = (
        task_item_repo.get_task_item(db, db_user.company_id, active_session.task_item_id)
        if db_user and active_session.task_item_id
        else None
    )

    active_session.end_time = end_time
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
