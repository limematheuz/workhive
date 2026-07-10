from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.google import calendar_client
from app.integrations.google.calendar_client import GoogleCalendarError
from app.integrations.google.token_crypto import encrypt_token
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.company import Company
from app.models.location import Location
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.task_calendar_event import TaskCalendarEvent
from app.models.task_item import TaskItem
from app.services.calendar_task_owner_service import resolve_calendar_owner_user_id
from app.models.user import User
from app.services.calendar_sync_payload import (
    event_payload,
    parse_google_datetime,
    target_user_ids as get_target_user_ids,
    task_is_scheduled,
    utc,
)
from app.services import calendar_sync_repository as sync_repo
from app.services import security_token_service


def connection_status(
    db: Session,
    company_id: int,
    user_id: int,
    *,
    include_company_connections: bool = False,
) -> dict:
    user_connection = sync_repo.connection(db, company_id, user_id)
    company_connections = (
        sync_repo.connections(db, company_id) if include_company_connections else []
    )
    pending_jobs = sync_repo.pending_job_count(db, company_id)
    configured = bool(
        settings.GOOGLE_CALENDAR_CLIENT_ID
        and settings.GOOGLE_CALENDAR_CLIENT_SECRET
    )
    return {
        "enabled": settings.GOOGLE_CALENDAR_ENABLED,
        "configured": configured,
        "connected": bool(user_connection and user_connection.status == "connected"),
        "status": user_connection.status if user_connection else "disconnected",
        "user_id": user_id,
        "google_account_email": (
            user_connection.google_account_email if user_connection else None
        ),
        "calendar_name": user_connection.calendar_name if user_connection else None,
        "last_sync_at": user_connection.last_sync_at if user_connection else None,
        "last_error": user_connection.last_error if user_connection else None,
        "pending_jobs": pending_jobs,
        "connected_users": [
            {
                "user_id": item.owner_user_id,
                "google_account_email": item.google_account_email,
                "calendar_name": item.calendar_name,
                "status": item.status,
                "last_sync_at": item.last_sync_at,
            }
            for item in company_connections
        ],
    }


def oauth_authorization_url(current_user: User) -> str:
    if not settings.GOOGLE_CALENDAR_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is disabled",
        )
    return calendar_client.authorization_url(
        company_id=current_user.company_id,
        user_id=current_user.id,
    )


def complete_oauth(
    db: Session,
    *,
    code: str,
    state: str,
) -> GoogleCalendarConnection:
    try:
        state_data = calendar_client.decode_oauth_state(state)
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc

    expires_at = state_data.get("exp")
    if isinstance(expires_at, (int, float)):
        expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    security_token_service.consume_token(
        db,
        jti=state_data.get("jti"),
        purpose="google_calendar_oauth",
        expires_at=expires_at,
    )

    company_id = int(state_data["company_id"])
    user_id = int(state_data["user_id"])
    company = db.query(Company).filter(Company.id == company_id).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not company or not user or user.company_id != company.id:
        raise HTTPException(status_code=400, detail="OAuth company is unavailable")

    tokens = calendar_client.exchange_authorization_code(code)
    access_token = tokens["access_token"]
    account_email = calendar_client.google_account_email(access_token)
    existing = sync_repo.connection(db, company.id, user.id)
    user_label = user.full_name or user.email
    calendar_name = f"WorkHive - {company.name} - {user_label}"[:255]
    if existing:
        connection = existing
    else:
        calendar = calendar_client.create_calendar(
            access_token,
            summary=calendar_name,
        )
        connection = GoogleCalendarConnection(
            company_id=company.id,
            owner_user_id=user.id,
            connected_by_user_id=user.id,
            calendar_id=calendar["id"],
            calendar_name=calendar_name,
            access_token_encrypted="",
        )
    connection.connected_by_user_id = user.id
    connection.owner_user_id = user.id
    connection.calendar_name = calendar_name
    connection.google_account_email = account_email
    connection.access_token_encrypted = encrypt_token(access_token)
    if tokens.get("refresh_token"):
        connection.refresh_token_encrypted = encrypt_token(tokens["refresh_token"])
    connection.token_expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(tokens.get("expires_in", 3600))
    )
    connection.status = "connected"
    connection.last_error = None
    connection.sync_token = None
    db.add(connection)
    db.commit()
    db.refresh(connection)

    tasks = db.query(TaskItem).filter(TaskItem.company_id == company.id).all()
    for task in tasks:
        if user.id in get_target_user_ids(task):
            enqueue_task_sync(db, task)
    return connection


def disconnect(db: Session, company_id: int, user_id: int) -> None:
    user_connection = sync_repo.connection(db, company_id, user_id)
    db.query(CalendarSyncJob).filter(
        CalendarSyncJob.company_id == company_id,
        CalendarSyncJob.user_id == user_id,
    ).delete(synchronize_session=False)
    db.query(TaskCalendarEvent).filter(
        TaskCalendarEvent.company_id == company_id,
        TaskCalendarEvent.user_id == user_id,
    ).delete(synchronize_session=False)
    if user_connection:
        db.delete(user_connection)
    db.commit()


def _target_user_ids_for_sync(db: Session, task: TaskItem) -> set[int]:
    connected_ids = sync_repo.connected_user_ids(db, task.company_id)
    target_ids = set(get_target_user_ids(task)) & connected_ids
    if target_ids:
        return target_ids

    fallback_user_id = resolve_calendar_owner_user_id(
        db,
        task.company_id,
        preferred_user_id=task.user_id,
    )
    return {fallback_user_id} if fallback_user_id in connected_ids else set()


def _queue_sync_job(
    db: Session,
    *,
    company_id: int,
    user_id: int,
    task_id: int | None,
    operation: str,
    external_event_id: str | None = None,
) -> None:
    query = db.query(CalendarSyncJob).filter(
        CalendarSyncJob.company_id == company_id,
        CalendarSyncJob.user_id == user_id,
        CalendarSyncJob.status.in_(["pending", "retry"]),
    )
    if task_id is None:
        query = query.filter(
            CalendarSyncJob.task_id.is_(None),
            CalendarSyncJob.external_event_id == external_event_id,
        )
    else:
        query = query.filter(CalendarSyncJob.task_id == task_id)
    pending = query.order_by(CalendarSyncJob.id.desc()).first()
    if pending:
        pending.operation = operation
        pending.external_event_id = external_event_id or pending.external_event_id
        pending.status = "pending"
        pending.next_attempt_at = None
        pending.last_error = None
        db.add(pending)
        return
    db.add(
        CalendarSyncJob(
            company_id=company_id,
            user_id=user_id,
            task_id=task_id,
            external_event_id=external_event_id,
            operation=operation,
        )
    )


def enqueue_task_sync(db: Session, task: TaskItem) -> None:
    mappings = sync_repo.mappings_for_task(db, task.company_id, task.id)
    mappings_by_user = {mapping.user_id: mapping for mapping in mappings}
    mapped_user_ids = set(mappings_by_user)
    scheduled = task_is_scheduled(task)
    target_user_ids = _target_user_ids_for_sync(db, task)
    delete_user_ids = mapped_user_ids - target_user_ids

    if not scheduled:
        delete_user_ids = mapped_user_ids
        target_user_ids = set()

    if not target_user_ids and not delete_user_ids:
        return

    for user_id in delete_user_ids:
        mapping = mappings_by_user.get(user_id)
        _queue_sync_job(
            db,
            company_id=task.company_id,
            user_id=user_id,
            task_id=task.id,
            external_event_id=mapping.external_event_id if mapping else None,
            operation="delete",
        )

    for user_id in target_user_ids:
        mapping = mappings_by_user.get(user_id)
        _queue_sync_job(
            db,
            company_id=task.company_id,
            user_id=user_id,
            task_id=task.id,
            external_event_id=mapping.external_event_id if mapping else None,
            operation="upsert",
        )
    db.commit()


def enqueue_task_deletion(db: Session, task: TaskItem) -> None:
    mappings = sync_repo.mappings_for_task(db, task.company_id, task.id)
    for mapping in mappings:
        _queue_sync_job(
            db,
            company_id=task.company_id,
            user_id=mapping.user_id,
            task_id=None,
            external_event_id=mapping.external_event_id,
            operation="delete",
        )
        db.delete(mapping)
    if mappings:
        db.commit()


def _save_mapping(
    db: Session,
    task: TaskItem,
    user_id: int,
    event: dict,
) -> TaskCalendarEvent:
    task_mapping = sync_repo.mapping(db, task.company_id, user_id, task.id)
    if not task_mapping:
        task_mapping = TaskCalendarEvent(
            company_id=task.company_id,
            user_id=user_id,
            task_id=task.id,
            external_event_id=event["id"],
        )
    task_mapping.external_event_id = event["id"]
    task_mapping.external_html_link = event.get("htmlLink")
    task_mapping.etag = event.get("etag")
    task_mapping.google_updated_at = parse_google_datetime(
        {"dateTime": event.get("updated")}
    )
    task_mapping.last_task_updated_at = task.updated_at
    task_mapping.status = "active"
    db.add(task_mapping)
    return task_mapping


def _process_job(
    db: Session,
    connection: GoogleCalendarConnection,
    job: CalendarSyncJob,
) -> str:
    task_mapping = (
        sync_repo.mapping(db, job.company_id, job.user_id, job.task_id)
        if job.task_id is not None
        else None
    )
    event_id = job.external_event_id or (
        task_mapping.external_event_id if task_mapping else None
    )
    task = (
        db.query(TaskItem)
        .filter(TaskItem.id == job.task_id, TaskItem.company_id == job.company_id)
        .first()
        if job.task_id is not None
        else None
    )
    should_delete = (
        job.operation == "delete"
        or not task
        or job.user_id not in _target_user_ids_for_sync(db, task)
        or not task_is_scheduled(task)
    )
    if should_delete:
        if event_id:
            try:
                calendar_client.delete_event(db, connection, event_id)
            except GoogleCalendarError as exc:
                if exc.status_code not in (404, 410):
                    raise
        if task_mapping:
            db.delete(task_mapping)
        return "deleted"

    payload = event_payload(task, job.user_id)
    if task_mapping:
        try:
            event = calendar_client.update_event(
                db,
                connection,
                task_mapping.external_event_id,
                payload,
            )
        except GoogleCalendarError as exc:
            if exc.status_code != 404:
                raise
            event = calendar_client.insert_event(db, connection, payload)
    else:
        try:
            event = calendar_client.insert_event(db, connection, payload)
        except GoogleCalendarError as exc:
            if exc.status_code != 409:
                raise
            event = calendar_client.update_event(
                db,
                connection,
                payload["id"],
                payload,
            )
    _save_mapping(db, task, job.user_id, event)
    return "exported"


def process_outbox(
    db: Session,
    company_id: int,
    *,
    user_id: int | None = None,
    limit: int = 100,
) -> dict[str, int]:
    result = {"exported": 0, "deleted": 0, "failed": 0}
    query = db.query(CalendarSyncJob).filter(
        CalendarSyncJob.company_id == company_id,
        CalendarSyncJob.status.in_(["pending", "retry"]),
    )
    if user_id is not None:
        query = query.filter(CalendarSyncJob.user_id == user_id)
    jobs = query.order_by(CalendarSyncJob.id.asc()).limit(limit).all()
    now = datetime.now(timezone.utc)
    for job in jobs:
        if job.next_attempt_at and utc(job.next_attempt_at) > now:
            continue
        user_connection = sync_repo.connection(db, company_id, job.user_id)
        if not user_connection:
            job.status = "done"
            job.last_error = None
            db.add(job)
            db.commit()
            continue
        try:
            action = _process_job(db, user_connection, job)
            result[action] += 1
            job.status = "done"
            job.last_error = None
            db.add(job)
            db.commit()
        except (GoogleCalendarError, ValueError) as exc:
            db.rollback()
            job = db.query(CalendarSyncJob).filter(
                CalendarSyncJob.id == job.id
            ).one()
            job.attempt_count += 1
            job.status = "retry"
            job.last_error = str(exc)[:2000]
            job.next_attempt_at = now + timedelta(
                minutes=min(2 ** job.attempt_count, 24 * 60)
            )
            db.add(job)
            db.commit()
            result["failed"] += 1
    return result


def _has_pending_local_change(
    db: Session,
    company_id: int,
    user_id: int,
    task_id: int,
) -> bool:
    return (
        db.query(CalendarSyncJob)
        .filter(
            CalendarSyncJob.company_id == company_id,
            CalendarSyncJob.user_id == user_id,
            CalendarSyncJob.task_id == task_id,
            CalendarSyncJob.status.in_(["pending", "retry"]),
        )
        .first()
        is not None
    )


def _queue_other_user_updates(
    db: Session,
    task: TaskItem,
    *,
    source_user_id: int,
) -> None:
    for user_id in _target_user_ids_for_sync(db, task):
        if user_id == source_user_id:
            continue
        task_mapping = sync_repo.mapping(db, task.company_id, user_id, task.id)
        _queue_sync_job(
            db,
            company_id=task.company_id,
            user_id=user_id,
            task_id=task.id,
            external_event_id=task_mapping.external_event_id if task_mapping else None,
            operation="upsert" if task_is_scheduled(task) else "delete",
        )


def _import_event(
    db: Session,
    connection: GoogleCalendarConnection,
    event: dict,
) -> bool:
    private = (event.get("extendedProperties") or {}).get("private") or {}
    task_id = private.get("workhive_task_id")
    company_id = private.get("workhive_company_id")
    user_id = private.get("workhive_user_id")

    if not task_id:
        # Check if we already have a mapping for this event_id
        mapping = db.query(TaskCalendarEvent).filter(
            TaskCalendarEvent.external_event_id == event["id"],
            TaskCalendarEvent.company_id == connection.company_id,
            TaskCalendarEvent.user_id == connection.owner_user_id
        ).first()

        if event.get("status") == "cancelled":
            if mapping:
                task = db.query(TaskItem).filter(
                    TaskItem.id == mapping.task_id,
                    TaskItem.company_id == connection.company_id
                ).first()
                if task:
                    db.delete(task)
                db.delete(mapping)
                return True
            return False

        # Find location
        location = db.query(Location).filter(
            (Location.managing_company_id == connection.company_id) |
            (Location.owner_company_id == connection.company_id)
        ).first()
        if not location:
            location = Location(
                name="General / Google Calendar",
                address="S/N",
                city="S/N",
                managing_company_id=connection.company_id,
                owner_company_id=connection.company_id,
            )
            db.add(location)
            db.flush()

        start = parse_google_datetime(event.get("start"))
        due = parse_google_datetime(event.get("end"))

        if mapping:
            task = db.query(TaskItem).filter(
                TaskItem.id == mapping.task_id,
                TaskItem.company_id == connection.company_id
            ).first()
            if not task:
                return False
            task.title = event.get("summary") or "Tarea importada de Google Calendar"
            task.description = event.get("description") or ""
            task.scheduled_start_at = start
            task.due_at = due
            db.add(task)
            _save_mapping(db, task, connection.owner_user_id, event)
            return True
        else:
            task = TaskItem(
                title=event.get("summary") or "Tarea importada de Google Calendar",
                description=event.get("description") or "",
                unit="service",
                status="accepted",
                priority="medium",
                company_id=connection.company_id,
                location_id=location.id,
                user_id=connection.owner_user_id,
                scheduled_start_at=start,
                due_at=due,
            )
            db.add(task)
            db.flush()
            _save_mapping(db, task, connection.owner_user_id, event)

            # Patch Google Calendar event to link it
            try:
                calendar_client.update_event(
                    db,
                    connection,
                    event["id"],
                    {
                        "extendedProperties": {
                            "private": {
                                "workhive_task_id": str(task.id),
                                "workhive_company_id": str(connection.company_id),
                                "workhive_user_id": str(connection.owner_user_id),
                            }
                        }
                    }
                )
            except Exception:
                pass
            return True

    if company_id != str(connection.company_id):
        return False
    if user_id and user_id != str(connection.owner_user_id):
        return False
    task = (
        db.query(TaskItem)
        .filter(
            TaskItem.id == int(task_id),
            TaskItem.company_id == connection.company_id,
        )
        .first()
    )
    if not task or _has_pending_local_change(
        db,
        connection.company_id,
        connection.owner_user_id,
        task.id,
    ):
        return False
    mapping = sync_repo.mapping(
        db,
        connection.company_id,
        connection.owner_user_id,
        task.id,
    )
    if event.get("status") == "cancelled":
        task.scheduled_start_at = None
        task.due_at = None
        if mapping:
            mapping.status = "deleted_in_google"
            db.add(mapping)
        db.add(task)
        _queue_other_user_updates(
            db,
            task,
            source_user_id=connection.owner_user_id,
        )
        return True

    google_updated = datetime.fromisoformat(
        event["updated"].replace("Z", "+00:00")
    )
    if mapping and mapping.google_updated_at:
        previous = utc(mapping.google_updated_at)
        if previous and google_updated <= previous:
            return False
    task.title = event.get("summary") or task.title
    task.scheduled_start_at = parse_google_datetime(event.get("start"))
    task.due_at = parse_google_datetime(event.get("end"))
    db.add(task)
    _save_mapping(db, task, connection.owner_user_id, event)
    _queue_other_user_updates(
        db,
        task,
        source_user_id=connection.owner_user_id,
    )
    return True


def _pull_connection_changes(
    db: Session,
    connection: GoogleCalendarConnection,
) -> int:
    imported = 0
    sync_token = connection.sync_token
    page_token = None
    while True:
        try:
            response = calendar_client.list_events(
                db,
                connection,
                sync_token=sync_token,
                page_token=page_token,
            )
        except GoogleCalendarError as exc:
            if exc.status_code == 410 and sync_token:
                connection.sync_token = None
                db.add(connection)
                db.commit()
                return _pull_connection_changes(db, connection)
            raise
        for event in response.get("items", []):
            imported += int(_import_event(db, connection, event))
        page_token = response.get("nextPageToken")
        if not page_token:
            connection.sync_token = response.get("nextSyncToken")
            break
    db.add(connection)
    db.commit()
    return imported


def pull_google_changes(
    db: Session,
    company_id: int,
    user_id: int | None = None,
) -> int:
    imported = 0
    for connection in sync_repo.connections(db, company_id, user_id):
        imported += _pull_connection_changes(db, connection)
    return imported


def synchronize(
    db: Session,
    company_id: int,
    user_id: int | None = None,
) -> dict:
    connections = sync_repo.connections(db, company_id, user_id)
    if not connections:
        raise HTTPException(status_code=409, detail="Google Calendar is not connected")

    try:
        outbox_before_pull = process_outbox(db, company_id, user_id=user_id)
        imported = pull_google_changes(db, company_id, user_id)
        outbox_after_pull = process_outbox(db, company_id, user_id=user_id)
        synced_at = datetime.now(timezone.utc)
        for connection in sync_repo.connections(db, company_id, user_id):
            connection.last_sync_at = synced_at
            connection.last_error = None
            connection.status = "connected"
            db.add(connection)
        db.commit()
    except GoogleCalendarError as exc:
        db.rollback()
        safe_error = (
            f"Google Calendar request failed (status {exc.status_code})"
            if exc.status_code is not None
            else "Google Calendar request failed"
        )
        for connection in sync_repo.connections(db, company_id, user_id):
            connection.last_error = safe_error
            connection.status = "error"
            db.add(connection)
        db.commit()
        raise HTTPException(status_code=502, detail=safe_error) from exc
    return {
        "imported": imported,
        "exported": outbox_before_pull["exported"] + outbox_after_pull["exported"],
        "deleted": outbox_before_pull["deleted"] + outbox_after_pull["deleted"],
        "failed": outbox_before_pull["failed"] + outbox_after_pull["failed"],
        "last_sync_at": synced_at,
    }
