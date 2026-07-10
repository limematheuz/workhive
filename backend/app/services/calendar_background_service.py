import asyncio
import logging

from fastapi import HTTPException

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.services import calendar_sync_service


logger = logging.getLogger("workhive.calendar")


def sync_user_calendar(company_id: int | None, user_id: int | None) -> None:
    if not settings.GOOGLE_CALENDAR_ENABLED or not company_id or not user_id:
        return

    from datetime import datetime, timezone, timedelta
    from app.models.calendar_sync_job import CalendarSyncJob

    db = SessionLocal()
    try:
        connection = (
            db.query(GoogleCalendarConnection)
            .filter(
                GoogleCalendarConnection.company_id == company_id,
                GoogleCalendarConnection.owner_user_id == user_id,
                GoogleCalendarConnection.status == "connected",
            )
            .first()
        )
        if not connection:
            return

        now = datetime.now(timezone.utc)

        # Count active pending jobs (pending status, or retry jobs whose delay has passed)
        pending_count = (
            db.query(CalendarSyncJob)
            .filter(
                CalendarSyncJob.company_id == company_id,
                CalendarSyncJob.user_id == user_id,
                CalendarSyncJob.status == "pending",
            )
            .count()
        )
        retry_count = (
            db.query(CalendarSyncJob)
            .filter(
                CalendarSyncJob.company_id == company_id,
                CalendarSyncJob.user_id == user_id,
                CalendarSyncJob.status == "retry",
                CalendarSyncJob.next_attempt_at <= now,
            )
            .count()
        )

        # Push local changes immediately if there are any
        if pending_count + retry_count > 0:
            calendar_sync_service.process_outbox(db, company_id, user_id=user_id)

        # Pull remote changes from Google at most once every 15 seconds
        last_sync = connection.last_sync_at
        should_pull = not last_sync
        if last_sync:
            if last_sync.tzinfo is None:
                last_sync = last_sync.replace(tzinfo=timezone.utc)
            should_pull = (now - last_sync) >= timedelta(seconds=15)

        if should_pull:
            calendar_sync_service.synchronize(db, company_id, user_id)

    except HTTPException as exc:
        if exc.status_code != 409:
            logger.warning(
                "Calendar background sync failed",
                extra={"company_id": company_id, "user_id": user_id, "detail": exc.detail},
            )
    except Exception:
        logger.exception(
            "Calendar background sync crashed",
            extra={"company_id": company_id, "user_id": user_id},
        )
    finally:
        db.close()


def sync_connected_calendars() -> None:
    if not settings.GOOGLE_CALENDAR_ENABLED:
        return

    db = SessionLocal()
    try:
        connections = (
            db.query(GoogleCalendarConnection.company_id, GoogleCalendarConnection.owner_user_id)
            .filter(GoogleCalendarConnection.status == "connected")
            .all()
        )
    finally:
        db.close()

    for company_id, user_id in connections:
        sync_user_calendar(company_id, user_id)


async def periodic_calendar_sync() -> None:
    if not settings.GOOGLE_CALENDAR_ENABLED:
        logger.info("Google Calendar background sync is disabled")
        return

    interval = max(30, settings.GOOGLE_CALENDAR_BACKGROUND_SYNC_INTERVAL_SECONDS)
    logger.info("Starting Google Calendar background sync", extra={"interval_seconds": interval})
    while True:
        try:
            await asyncio.sleep(interval)
            await asyncio.to_thread(sync_connected_calendars)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unexpected error in Google Calendar background sync loop")
