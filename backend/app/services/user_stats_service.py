import calendar
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import task_item as task_item_repo
from app.repositories import user as user_repo
from app.repositories import work_session as work_session_repo
from app.schemas.user import UserStatsResponse
from app.services import task_assignment_service
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import is_platform_superadmin, is_superadmin


def get_user_stats(
    db: Session, user_id: int, current_user: User, time_range: str | None = None
) -> UserStatsResponse:
    db_user = user_repo.get_user_by_id(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    is_own_profile = current_user.id == user_id
    is_super_admin = is_superadmin(current_user)
    if (
        not is_own_profile
        and not is_platform_superadmin(current_user)
        and db_user.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view this user's stats",
        )

    if is_super_admin and db_user.company_id is None:
        return UserStatsResponse(
            total_hours_worked=0,
            total_tasks=0,
            tasks_completed=0,
            tasks_pending=0,
            active_session_id=None,
            locations_worked_count=0,
        )

    visible_location_ids = (
        None
        if is_own_profile or is_platform_superadmin(current_user)
        else permitted_location_ids(db, current_user, "time.read")
    )

    start_date = None
    if time_range and time_range != "all":
        now = datetime.now(timezone.utc)
        if time_range == "day":
            start_date = now - timedelta(days=1)
        elif time_range == "week":
            start_date = now - timedelta(days=7)
        elif time_range == "month":
            year = now.year
            month = now.month - 1
            if month == 0:
                month = 12
                year -= 1
            max_days_prev_month = calendar.monthrange(year, month)[1]
            day = min(now.day, max_days_prev_month)
            start_date = now.replace(year=year, month=month, day=day)
        elif time_range == "year":
            year = now.year - 1
            day = now.day
            if now.month == 2 and now.day == 29 and not calendar.isleap(year):
                day = 28
            start_date = now.replace(year=year, day=day)

    active_session = work_session_repo.get_active_session_by_user(db, user_id)
    if (
        active_session is not None
        and visible_location_ids is not None
        and active_session.location_id not in visible_location_ids
    ):
        active_session = None
    active_session_id = active_session.id if active_session else None

    closed_sessions = work_session_repo.get_closed_sessions_by_user(
        db, user_id, start_date, visible_location_ids
    )
    total_seconds = sum(
        (session.end_time - session.start_time).total_seconds()
        for session in closed_sessions
    )
    total_hours_worked = round(total_seconds / 3600.0, 2)

    total_tasks = task_item_repo.count_tasks_by_user(
        db,
        user_id,
        start_date,
        statuses=task_assignment_service.OPERATIONAL_VIEWER_STATUSES,
        location_ids=visible_location_ids,
    )
    tasks_completed = task_item_repo.count_tasks_by_user_and_status(
        db, user_id, "completed", start_date, visible_location_ids
    )
    tasks_pending = task_item_repo.count_tasks_by_user_and_status(
        db, user_id, "pending", start_date, visible_location_ids
    )

    session_locations = work_session_repo.get_distinct_location_ids_by_user(
        db, user_id, start_date, visible_location_ids
    )
    task_locations = task_item_repo.get_distinct_location_ids_by_user(
        db, user_id, start_date, visible_location_ids
    )
    locations_worked_count = len(set(session_locations) | set(task_locations))

    return UserStatsResponse(
        total_hours_worked=total_hours_worked,
        total_tasks=total_tasks,
        tasks_completed=tasks_completed,
        tasks_pending=tasks_pending,
        active_session_id=active_session_id,
        locations_worked_count=locations_worked_count,
    )
