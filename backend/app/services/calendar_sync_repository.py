from sqlalchemy.orm import Session

from app.models.calendar_sync_job import CalendarSyncJob
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.task_calendar_event import TaskCalendarEvent


def connection(
    db: Session,
    company_id: int,
) -> GoogleCalendarConnection | None:
    return (
        db.query(GoogleCalendarConnection)
        .filter(
            GoogleCalendarConnection.company_id == company_id,
        )
        .first()
    )


def connections(
    db: Session,
    company_id: int,
    user_id: int | None = None,
) -> list[GoogleCalendarConnection]:
    query = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.company_id == company_id
    )
    if user_id is not None:
        query = query.filter(GoogleCalendarConnection.owner_user_id == user_id)
    return query.order_by(GoogleCalendarConnection.id.asc()).all()


def connected_user_ids(db: Session, company_id: int) -> set[int]:
    return {
        item.owner_user_id
        for item in connections(db, company_id)
        if item.status == "connected"
    }


def pending_job_count(db: Session, company_id: int) -> int:
    return (
        db.query(CalendarSyncJob)
        .filter(
            CalendarSyncJob.company_id == company_id,
            CalendarSyncJob.status.in_(["pending", "retry"]),
        )
        .count()
    )


def mapping(
    db: Session,
    company_id: int,
    user_id: int,
    task_id: int,
) -> TaskCalendarEvent | None:
    return (
        db.query(TaskCalendarEvent)
        .filter(
            TaskCalendarEvent.company_id == company_id,
            TaskCalendarEvent.user_id == user_id,
            TaskCalendarEvent.task_id == task_id,
        )
        .first()
    )


def mappings_for_task(
    db: Session,
    company_id: int,
    task_id: int,
) -> list[TaskCalendarEvent]:
    return (
        db.query(TaskCalendarEvent)
        .filter(
            TaskCalendarEvent.company_id == company_id,
            TaskCalendarEvent.task_id == task_id,
        )
        .all()
    )
