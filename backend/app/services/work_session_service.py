from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.work_session import WorkSession
from app.models.user import User
from app.schemas.work_session import WorkSessionCreate
from app.repositories import work_session as work_session_repo
from app.repositories import user as user_repo
from app.repositories import task_item as task_item_repo
from app.schemas.work_session import (
    ActiveCompanySessionResponse,
    TaskWorkSummaryResponse,
    TaskWorkDetailedSummaryResponse,
    WorkerTimeSummary,
)
from app.services import task_assignment_service
from app.services import task_structure_service
from app.services import task_item_service


def get_work_sessions(
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> list[WorkSession]:
    return work_session_repo.get_work_session_by_user(db, user_id, skip, limit)


def get_work_session(db: Session, session_id: int, user_id: int) -> WorkSession:
    work_session = work_session_repo.get_work_session_by_id(db, session_id, user_id)
    if work_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Work Session not found"
        )
    return work_session


def get_active_session(db: Session, user_id: int) -> WorkSession | None:
    return work_session_repo.get_active_session_by_user(db, user_id)


def start_work_session(
    db: Session, user_id: int, session_data: WorkSessionCreate
) -> WorkSession:
    db_user = user_repo.get_user_by_id(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
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


def get_task_work_summary(
    db: Session, current_user: User, task_item_id: int
) -> TaskWorkSummaryResponse:
    task = task_item_repo.get_task_item(db, current_user.company_id, task_item_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task Item not found")
    if (
        current_user.role.name == "viewer"
        and not task_assignment_service.is_user_assigned(task, current_user.id)
    ):
        raise HTTPException(status_code=404, detail="Task Item not found")

    now = datetime.now(timezone.utc)
    sessions = work_session_repo.get_sessions_by_task(db, task_item_id)
    total_seconds = 0
    active_workers: set[int] = set()
    for work_session in sessions:
        end_time = work_session.end_time or now
        start_time = work_session.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        total_seconds += max(0, int((end_time - start_time).total_seconds()))
        if work_session.end_time is None:
            active_workers.add(work_session.user_id)

    return TaskWorkSummaryResponse(
        task_item_id=task_item_id,
        total_seconds=total_seconds,
        active_workers=len(active_workers),
        session_count=len(sessions),
    )


def get_active_company_sessions(
    db: Session, current_user: User
) -> list[ActiveCompanySessionResponse]:
    if current_user.company_id is None:
        return []

    now = datetime.now(timezone.utc)
    responses: list[ActiveCompanySessionResponse] = []
    for work_session in work_session_repo.get_visible_active_sessions(
        db, current_user.company_id
    ):
        start_time = work_session.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        responses.append(
            ActiveCompanySessionResponse(
                id=work_session.id,
                user_id=work_session.user_id,
                notes=work_session.notes,
                location_id=work_session.location_id,
                task_item_id=work_session.task_item_id,
                start_latitude=work_session.start_latitude,
                start_longitude=work_session.start_longitude,
                start_accuracy_meters=work_session.start_accuracy_meters,
                start_time=work_session.start_time,
                end_time=work_session.end_time,
                created_at=work_session.created_at,
                updated_at=work_session.updated_at,
                user_name=work_session.user.full_name or work_session.user.email,
                user_email=work_session.user.email,
                worker_company_id=work_session.user.company_id,
                worker_company_name=work_session.user.company.name,
                visibility_scope=(
                    "own"
                    if work_session.user.company_id == current_user.company_id
                    else "collaborator"
                ),
                location_name=work_session.location.name,
                task_title=(
                    work_session.task_item.title
                    if work_session.task_item
                    else None
                ),
                elapsed_seconds=max(
                    0, int((now - start_time).total_seconds())
                ),
            )
        )
    return responses


def get_task_work_detailed_summary(
    db: Session, current_user: User, task_item_id: int
) -> TaskWorkDetailedSummaryResponse:
    task = task_item_repo.get_task_item(db, current_user.company_id, task_item_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task Item not found")
    if (
        current_user.role.name == "viewer"
        and not task_assignment_service.is_user_assigned(task, current_user.id)
    ):
        raise HTTPException(status_code=404, detail="Task Item not found")

    if current_user.company_id is None:
        sessions = work_session_repo.get_sessions_by_task(db, task_item_id)
    else:
        sessions = work_session_repo.get_visible_sessions_by_task(
            db, current_user.company_id, task_item_id
        )

    return _build_task_work_detailed_summary(
        task_item_id,
        sessions,
        datetime.now(timezone.utc),
    )


def get_task_work_detailed_summaries(
    db: Session, current_user: User, task_item_ids: list[int]
) -> list[TaskWorkDetailedSummaryResponse]:
    requested_ids = list(dict.fromkeys(task_item_ids))
    if not requested_ids:
        return []

    visible_tasks = task_item_repo.get_task_items_by_ids(
        db,
        current_user.company_id,
        requested_ids,
        user_id=current_user.id if current_user.role.name == "viewer" else None,
    )
    visible_ids = [task.id for task in visible_tasks]
    if not visible_ids:
        return []

    if current_user.company_id is None:
        sessions = work_session_repo.get_sessions_by_tasks(db, visible_ids)
    else:
        sessions = work_session_repo.get_visible_sessions_by_tasks(
            db,
            current_user.company_id,
            visible_ids,
        )

    sessions_by_task: dict[int, list[WorkSession]] = {
        task_id: [] for task_id in visible_ids
    }
    for session in sessions:
        if session.task_item_id in sessions_by_task:
            sessions_by_task[session.task_item_id].append(session)

    now = datetime.now(timezone.utc)
    return [
        _build_task_work_detailed_summary(task_id, sessions_by_task[task_id], now)
        for task_id in visible_ids
    ]


def _build_task_work_detailed_summary(
    task_item_id: int,
    sessions: list[WorkSession],
    now: datetime,
) -> TaskWorkDetailedSummaryResponse:
    # Group by user_id.
    user_data: dict[int, dict] = {}
    for ws in sessions:
        end = ws.end_time or now
        start = ws.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        secs = max(0, int((end - start).total_seconds()))
        is_active = ws.end_time is None

        if ws.user_id not in user_data:
            user_name = (
                ws.user.full_name or ws.user.email
                if ws.user
                else f"User {ws.user_id}"
            )
            user_data[ws.user_id] = {
                "user_id": ws.user_id,
                "user_name": user_name or f"User {ws.user_id}",
                "total_seconds": 0,
                "is_active": False,
            }
        user_data[ws.user_id]["total_seconds"] += secs
        if is_active:
            user_data[ws.user_id]["is_active"] = True

    total_seconds = sum(d["total_seconds"] for d in user_data.values())
    active_workers = sum(1 for d in user_data.values() if d["is_active"])

    return TaskWorkDetailedSummaryResponse(
        task_item_id=task_item_id,
        total_seconds=total_seconds,
        active_workers=active_workers,
        session_count=len(sessions),
        workers=[WorkerTimeSummary(**d) for d in user_data.values()],
        start_locations=[
            {
                "session_id": work_session.id,
                "user_id": work_session.user_id,
                "user_name": (
                    work_session.user.full_name
                    or work_session.user.email
                    if work_session.user
                    else f"User {work_session.user_id}"
                ),
                "started_at": work_session.start_time,
                "latitude": work_session.start_latitude,
                "longitude": work_session.start_longitude,
                "accuracy_meters": work_session.start_accuracy_meters,
            }
            for work_session in sessions
            if work_session.start_latitude is not None
            and work_session.start_longitude is not None
        ],
    )
