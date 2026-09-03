"""Read models and summaries for work-session reporting."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import task_item as task_item_repo
from app.repositories import work_session as work_session_repo
from app.schemas.work_session import (
    ActiveCompanySessionResponse,
    TaskWorkDetailedSummaryResponse,
    TaskWorkSummaryResponse,
    WorkerTimeSummary,
)
from app.services import task_assignment_service
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import (
    require_capability,
    uses_legacy_role_authorization,
)


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


def _get_visible_task_or_404(db: Session, current_user: User, task_item_id: int):
    task = task_item_repo.get_task_item(db, current_user.company_id, task_item_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task Item not found")
    require_capability(
        db,
        current_user,
        "time.read",
        scope_type="location",
        scope_id=task.location_id,
    )
    if (
        current_user.role.name == "viewer"
        and uses_legacy_role_authorization(db, current_user, "time.read")
        and not task_assignment_service.is_user_assigned(task, current_user.id)
    ):
        raise HTTPException(status_code=404, detail="Task Item not found")
    return task


def get_task_work_summary(
    db: Session, current_user: User, task_item_id: int
) -> TaskWorkSummaryResponse:
    _require_time_tracking_feature(db, current_user.company_id)
    _get_visible_task_or_404(db, current_user, task_item_id)

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
    db: Session,
    current_user: User,
    location_ids: set[int] | None = None,
) -> list[ActiveCompanySessionResponse]:
    if current_user.company_id is None:
        return []
    _require_time_tracking_feature(db, current_user.company_id)

    now = datetime.now(timezone.utc)
    responses: list[ActiveCompanySessionResponse] = []
    for work_session in work_session_repo.get_visible_active_sessions(
        db,
        current_user.company_id,
        location_ids,
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
                    work_session.task_item.title if work_session.task_item else None
                ),
                elapsed_seconds=max(0, int((now - start_time).total_seconds())),
            )
        )
    return responses


def get_task_work_detailed_summary(
    db: Session, current_user: User, task_item_id: int
) -> TaskWorkDetailedSummaryResponse:
    _require_time_tracking_feature(db, current_user.company_id)
    _get_visible_task_or_404(db, current_user, task_item_id)

    if current_user.company_id is None:
        sessions = work_session_repo.get_sessions_by_task(db, task_item_id)
    else:
        sessions = work_session_repo.get_visible_sessions_by_task(
            db,
            current_user.company_id,
            task_item_id,
        )

    return _build_task_work_detailed_summary(
        task_item_id,
        sessions,
        datetime.now(timezone.utc),
    )


def get_task_work_detailed_summaries(
    db: Session, current_user: User, task_item_ids: list[int]
) -> list[TaskWorkDetailedSummaryResponse]:
    _require_time_tracking_feature(db, current_user.company_id)
    requested_ids = list(dict.fromkeys(task_item_ids))
    if not requested_ids:
        return []

    visible_tasks = task_item_repo.get_task_items_by_ids(
        db,
        current_user.company_id,
        requested_ids,
        user_id=(
            current_user.id
            if current_user.role.name == "viewer"
            and uses_legacy_role_authorization(db, current_user, "time.read")
            else None
        ),
    )
    for task in visible_tasks:
        require_capability(
            db,
            current_user,
            "time.read",
            scope_type="location",
            scope_id=task.location_id,
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
    user_data: dict[int, dict] = {}
    for work_session in sessions:
        end_time = work_session.end_time or now
        start_time = work_session.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        elapsed_seconds = max(0, int((end_time - start_time).total_seconds()))
        is_active = work_session.end_time is None

        if work_session.user_id not in user_data:
            user_name = (
                work_session.user.full_name or work_session.user.email
                if work_session.user
                else f"User {work_session.user_id}"
            )
            user_data[work_session.user_id] = {
                "user_id": work_session.user_id,
                "user_name": user_name or f"User {work_session.user_id}",
                "total_seconds": 0,
                "is_active": False,
            }
        user_data[work_session.user_id]["total_seconds"] += elapsed_seconds
        if is_active:
            user_data[work_session.user_id]["is_active"] = True

    total_seconds = sum(data["total_seconds"] for data in user_data.values())
    active_workers = sum(1 for data in user_data.values() if data["is_active"])

    return TaskWorkDetailedSummaryResponse(
        task_item_id=task_item_id,
        total_seconds=total_seconds,
        active_workers=active_workers,
        session_count=len(sessions),
        workers=[WorkerTimeSummary(**data) for data in user_data.values()],
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
