from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import task_item as task_item_repo
from app.repositories import work_session as work_session_repo
from app.schemas.location_history import (
    LocationHistoryPeriod,
    LocationHistorySessionResponse,
    LocationHistoryTaskResponse,
    LocationOperationalHistoryResponse,
)
from app.services import location_access_service, task_assignment_service
from app.services.user_scope import can_manage_company


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _period_bounds(period: LocationHistoryPeriod, anchor_date: date | None) -> tuple[datetime, datetime]:
    local_zone = ZoneInfo(settings.GOOGLE_CALENDAR_TIMEZONE)
    anchor = anchor_date or datetime.now(local_zone).date()
    if period == "day":
        start_date = anchor
        end_date = anchor + timedelta(days=1)
    elif period == "week":
        start_date = anchor - timedelta(days=anchor.weekday())
        end_date = start_date + timedelta(days=7)
    elif period == "month":
        start_date = anchor.replace(day=1)
        end_date = (
            start_date.replace(year=start_date.year + 1, month=1)
            if start_date.month == 12
            else start_date.replace(month=start_date.month + 1)
        )
    else:  # Pydantic validates this at the transport boundary; keep service fail-closed too.
        raise HTTPException(status_code=422, detail="Unsupported history period")
    return (
        datetime.combine(start_date, time.min, tzinfo=local_zone).astimezone(timezone.utc),
        datetime.combine(end_date, time.min, tzinfo=local_zone).astimezone(timezone.utc),
    )


def _visible_location_tasks(db: Session, current_user: User, location_id: int) -> list[TaskItem]:
    tasks = task_item_repo.get_task_items(
        db,
        current_user.company_id,
        user_id=None if can_manage_company(current_user) else current_user.id,
        location_id=location_id,
        include_requested=can_manage_company(current_user),
        limit=10_000,
    )
    if current_user.role.name != "viewer":
        return tasks
    return [
        task
        for task in tasks
        if task_assignment_service.can_viewer_access_task(task, current_user.id)
    ]


def get_operational_history(
    db: Session,
    current_user: User,
    *,
    location_id: int,
    period: LocationHistoryPeriod,
    anchor_date: date | None,
    completed_offset: int = 0,
    sessions_offset: int = 0,
    limit: int = 20,
) -> LocationOperationalHistoryResponse:
    """Return a read-only operational ledger for one accessible location.

    It never changes task or work-session state. A company sees only tasks and
    tracked time it may already see elsewhere: workers get their own work;
    managers get their company's work plus provider time for their external
    reservation tasks.
    """
    location_access_service.require_accessible_location(db, current_user, location_id)
    period_start, period_end = _period_bounds(period, anchor_date)
    visible_tasks = _visible_location_tasks(db, current_user, location_id)
    visible_task_ids = [task.id for task in visible_tasks]
    task_titles = {task.id: task.title for task in visible_tasks}

    completed_tasks: list[LocationHistoryTaskResponse] = []
    for task in visible_tasks:
        if task.status != "completed":
            continue
        completed_at = _as_utc(task.date_done or task.updated_at or task.created_at)
        if period_start <= completed_at < period_end:
            completed_tasks.append(
                LocationHistoryTaskResponse(
                    id=task.id,
                    title=task.title,
                    status=task.status,
                    completed_at=completed_at,
                    scheduled_start_at=task.scheduled_start_at,
                )
            )
    completed_tasks.sort(key=lambda task: task.completed_at, reverse=True)
    completed_task_total = len(completed_tasks)

    sessions = work_session_repo.get_visible_sessions_by_tasks(
        db,
        current_user.company_id,
        visible_task_ids,
    )
    if not can_manage_company(current_user):
        sessions = [session for session in sessions if session.user_id == current_user.id]

    history_sessions: list[LocationHistorySessionResponse] = []
    for session in sessions:
        if session.location_id != location_id or session.end_time is None:
            continue
        started_at = _as_utc(session.start_time)
        ended_at = _as_utc(session.end_time)
        if started_at >= period_end or ended_at <= period_start:
            continue
        clipped_start = max(started_at, period_start)
        clipped_end = min(ended_at, period_end)
        worked_seconds = max(0, int((clipped_end - clipped_start).total_seconds()))
        if worked_seconds == 0:
            continue
        history_sessions.append(
            LocationHistorySessionResponse(
                id=session.id,
                task_item_id=session.task_item_id,
                task_title=task_titles.get(session.task_item_id),
                user_id=session.user_id,
                user_name=(session.user.full_name or session.user.email) if session.user else f"Usuario {session.user_id}",
                started_at=started_at,
                ended_at=ended_at,
                worked_seconds=worked_seconds,
            )
        )
    history_sessions.sort(key=lambda session: session.ended_at, reverse=True)
    session_total = len(history_sessions)

    return LocationOperationalHistoryResponse(
        location_id=location_id,
        period=period,
        period_start=period_start,
        period_end=period_end,
        completed_tasks=completed_tasks[completed_offset: completed_offset + limit],
        sessions=history_sessions[sessions_offset: sessions_offset + limit],
        completed_task_count=completed_task_total,
        completed_task_total=completed_task_total,
        session_total=session_total,
        worked_seconds=sum(session.worked_seconds for session in history_sessions),
    )
