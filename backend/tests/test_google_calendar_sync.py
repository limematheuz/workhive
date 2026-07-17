from datetime import datetime, timedelta, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.core.config import settings
from app.integrations.google import calendar_client
from app.integrations.google.token_crypto import decrypt_token, encrypt_token
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.company import Company
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.location import Location
from app.models.task_calendar_event import TaskCalendarEvent
from app.models.task_item import TaskItem
from app.models.user import User
from app.services import calendar_background_service, calendar_sync_service


def _calendar_entities(db):
    company = Company(
        name="Calendar Company",
        tax_id="CALENDAR-TEST",
        address="Calle Agenda 1",
        phone="600000001",
        email="calendar@test.local",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    user = User(
        email="calendar-admin@test.local",
        hashed_password="unused",
        full_name="Calendar Admin",
        role_id=1,
        company_id=company.id,
    )
    location = Location(
        name="Calendar Location",
        address="Calle Agenda 2",
        city="Madrid",
        managing_company_id=company.id,
    )
    db.add_all([user, location])
    db.commit()
    db.refresh(user)
    db.refresh(location)

    connection = GoogleCalendarConnection(
        company_id=company.id,
        connected_by_user_id=user.id,
        owner_user_id=user.id,
        google_account_email=user.email,
        calendar_id="workhive-calendar",
        calendar_name="WorkHive - Calendar Company",
        access_token_encrypted=encrypt_token("access-token"),
        refresh_token_encrypted=encrypt_token("refresh-token"),
        token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    task = TaskItem(
        title="Prepare apartment",
        description="Check all rooms",
        unit="service",
        status="accepted",
        priority="high",
        company_id=company.id,
        location_id=location.id,
        user_id=user.id,
        scheduled_start_at=datetime(2026, 6, 20, 8, tzinfo=timezone.utc),
        due_at=datetime(2026, 6, 20, 10, tzinfo=timezone.utc),
    )
    db.add_all([connection, task])
    db.commit()
    db.refresh(connection)
    db.refresh(task)
    return company, user, connection, task


def test_google_tokens_are_encrypted_at_rest():
    encrypted = encrypt_token("sensitive-token")

    assert encrypted != "sensitive-token"
    assert decrypt_token(encrypted) == "sensitive-token"


def test_stale_encryption_key_marks_connection_for_reconnect(db):
    company, _, connection, _ = _calendar_entities(db)
    foreign_cipher = Fernet(Fernet.generate_key())
    connection.access_token_encrypted = foreign_cipher.encrypt(
        b"unreadable-access-token"
    ).decode("ascii")
    connection.refresh_token_encrypted = foreign_cipher.encrypt(
        b"unreadable-refresh-token"
    ).decode("ascii")
    db.add(connection)
    db.commit()

    with pytest.raises(HTTPException) as error:
        calendar_sync_service.synchronize(db, company.id)

    assert error.value.status_code == 502
    db.refresh(connection)
    assert connection.status == "error"
    assert connection.last_error == "Google Calendar request failed (status 401)"
    assert "token" not in connection.last_error.lower()


def test_company_background_sync_resolves_primary_connection_owner(
    db,
    monkeypatch,
):
    company, owner, _, _ = _calendar_entities(db)
    calls = []

    class SessionProxy:
        def __getattr__(self, name):
            return getattr(db, name)

        def close(self):
            return None

    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_ENABLED", True)
    monkeypatch.setattr(
        calendar_background_service,
        "SessionLocal",
        lambda: SessionProxy(),
    )
    monkeypatch.setattr(
        calendar_background_service.calendar_governance_service,
        "company_calendar_available",
        lambda _db: True,
    )
    monkeypatch.setattr(
        calendar_sync_service,
        "synchronize",
        lambda _db, company_id, user_id: calls.append((company_id, user_id)),
    )

    calendar_background_service.sync_company_calendar(company.id)

    assert calls == [(company.id, owner.id)]


def test_oauth_state_and_authorization_url_are_company_scoped(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_CLIENT_ID", "client-id")
    monkeypatch.setattr(
        settings,
        "GOOGLE_CALENDAR_REDIRECT_URI",
        "http://localhost:8000/api/v1/calendar/google/callback",
    )

    url = calendar_client.authorization_url(company_id=12, user_id=34)
    state = url.split("state=", 1)[1].split("&", 1)[0]
    decoded = calendar_client.decode_oauth_state(state)

    assert "access_type=offline" in url
    assert decoded["company_id"] == 12
    assert decoded["user_id"] == 34


def test_outbox_creates_updates_and_deletes_google_event(db, monkeypatch):
    company, user, connection, task = _calendar_entities(db)
    inserted_payloads = []
    updated_payloads = []
    deleted_events = []

    def insert_event(_db, _connection, payload):
        inserted_payloads.append(payload)
        return {
            "id": "google-event-1",
            "htmlLink": "https://calendar.google.com/event/1",
            "etag": "etag-1",
            "updated": "2026-06-15T10:00:00Z",
        }

    def update_event(_db, _connection, event_id, payload):
        updated_payloads.append((event_id, payload))
        return {
            "id": event_id,
            "htmlLink": "https://calendar.google.com/event/1",
            "etag": "etag-2",
            "updated": "2026-06-15T11:00:00Z",
        }

    def delete_event(_db, _connection, event_id):
        deleted_events.append(event_id)

    monkeypatch.setattr(calendar_client, "insert_event", insert_event)
    monkeypatch.setattr(calendar_client, "update_event", update_event)
    monkeypatch.setattr(calendar_client, "delete_event", delete_event)

    calendar_sync_service.enqueue_task_sync(db, task)
    assert calendar_sync_service.process_outbox(db, company.id)["exported"] == 1
    mapping = db.query(TaskCalendarEvent).filter_by(
        task_id=task.id,
        user_id=user.id,
    ).one()
    assert mapping.external_event_id == "google-event-1"
    private_metadata = inserted_payloads[0]["extendedProperties"]["private"]
    assert private_metadata["workhive_task_id"] == str(task.id)
    assert private_metadata["workhive_company_id"] == str(company.id)
    assert private_metadata["workhive_user_id"] == str(user.id)
    assert private_metadata["workhive_updated_at"]
    assert inserted_payloads[0]["sequence"] > 0
    assert inserted_payloads[0]["id"] == (
        f"a{company.id:08x}{user.id:08x}{task.id:08x}"
    )

    task.title = "Prepare apartment and terrace"
    db.add(task)
    db.commit()
    calendar_sync_service.enqueue_task_sync(db, task)
    assert calendar_sync_service.process_outbox(db, company.id)["exported"] == 1
    assert updated_payloads[0][0] == "google-event-1"
    assert updated_payloads[0][1]["summary"] == task.title

    task.scheduled_start_at = None
    task.due_at = None
    db.add(task)
    db.commit()
    calendar_sync_service.enqueue_task_sync(db, task)
    assert calendar_sync_service.process_outbox(db, company.id)["deleted"] == 1
    assert deleted_events == ["google-event-1"]
    assert db.query(TaskCalendarEvent).filter_by(
        task_id=task.id,
        user_id=user.id,
    ).first() is None
    assert connection.status == "connected"


def test_synchronize_exports_pending_workhive_changes_before_pull(db, monkeypatch):
    company, _, _, task = _calendar_entities(db)
    calls = []

    def insert_event(_db, _connection, payload):
        calls.append("export")
        return {
            "id": payload["id"],
            "htmlLink": "https://calendar.google.com/event/order",
            "etag": "etag-order",
            "updated": "2026-06-15T10:00:00Z",
        }

    def list_events(_db, _connection, *, sync_token, page_token=None):
        assert calls == ["export"]
        calls.append("pull")
        return {"items": [], "nextSyncToken": "order-sync-token"}

    monkeypatch.setattr(calendar_client, "insert_event", insert_event)
    monkeypatch.setattr(calendar_client, "list_events", list_events)

    calendar_sync_service.enqueue_task_sync(db, task)
    result = calendar_sync_service.synchronize(db, company.id)

    assert calls == ["export", "pull"]
    assert result["exported"] == 1
    assert result["imported"] == 0


def test_incremental_google_change_updates_linked_task(db, monkeypatch):
    company, user, connection, task = _calendar_entities(db)
    mapping = TaskCalendarEvent(
        company_id=company.id,
        user_id=user.id,
        task_id=task.id,
        external_event_id="google-event-2",
        google_updated_at=datetime(2026, 6, 15, 10, tzinfo=timezone.utc),
    )
    db.add(mapping)
    db.commit()

    def list_events(_db, _connection, *, sync_token, page_token=None):
        assert sync_token is None
        assert page_token is None
        return {
            "items": [
                {
                    "id": "google-event-2",
                    "status": "confirmed",
                    "summary": "Title changed in Google",
                    "updated": "2026-06-15T12:00:00Z",
                    "start": {"dateTime": "2026-06-21T09:00:00+02:00"},
                    "end": {"dateTime": "2026-06-21T11:00:00+02:00"},
                    "extendedProperties": {
                        "private": {
                            "workhive_task_id": str(task.id),
                            "workhive_company_id": str(company.id),
                            "workhive_user_id": str(user.id),
                        }
                    },
                }
            ],
            "nextSyncToken": "next-sync-token",
        }

    monkeypatch.setattr(calendar_client, "list_events", list_events)

    assert calendar_sync_service.pull_google_changes(db, company.id) == 1
    db.refresh(task)
    db.refresh(connection)
    assert task.title == "Title changed in Google"
    assert task.scheduled_start_at.hour == 7
    assert connection.sync_token == "next-sync-token"


def test_assignment_change_keeps_event_in_company_calendar(db, monkeypatch):
    company, first_user, _, task = _calendar_entities(db)
    second_user = User(
        email="calendar-manager@test.local",
        hashed_password="unused",
        full_name="Calendar Manager",
        role_id=2,
        company_id=company.id,
    )
    db.add(second_user)
    db.commit()
    db.refresh(second_user)
    inserted = []
    updated = []

    def insert_event(_db, connection, payload):
        inserted.append((connection.owner_user_id, payload["id"]))
        return {
            "id": payload["id"],
            "htmlLink": "https://calendar.google.com/event/moved",
            "etag": "etag-moved",
            "updated": "2026-06-15T10:00:00Z",
        }

    def update_event(_db, connection, event_id, payload):
        updated.append((connection.owner_user_id, event_id, payload["summary"]))
        return {
            "id": event_id,
            "htmlLink": "https://calendar.google.com/event/updated",
            "etag": "etag-updated",
            "updated": "2026-06-15T11:00:00Z",
        }

    monkeypatch.setattr(calendar_client, "insert_event", insert_event)
    monkeypatch.setattr(calendar_client, "update_event", update_event)

    calendar_sync_service.enqueue_task_sync(db, task)
    assert calendar_sync_service.process_outbox(db, company.id)["exported"] == 1
    first_event_id = f"a{company.id:08x}{first_user.id:08x}{task.id:08x}"
    assert inserted == [(first_user.id, first_event_id)]

    task.user_id = second_user.id
    db.add(task)
    db.commit()
    calendar_sync_service.enqueue_task_sync(db, task)
    result = calendar_sync_service.process_outbox(db, company.id)

    assert result["exported"] == 1
    assert result["deleted"] == 0
    assert inserted == [(first_user.id, first_event_id)]
    assert updated == [(first_user.id, first_event_id, task.title)]
    assert db.query(TaskCalendarEvent).filter_by(
        task_id=task.id,
        user_id=first_user.id,
    ).one().external_event_id == first_event_id
    assert db.query(TaskCalendarEvent).filter_by(
        task_id=task.id,
        user_id=second_user.id,
    ).first() is None


def test_task_assigned_to_unconnected_worker_syncs_to_calendar_owner(db, monkeypatch):
    company, admin_user, _, task = _calendar_entities(db)
    worker = User(
        email="worker-no-calendar@test.local",
        hashed_password="unused",
        full_name="Worker Without Calendar",
        role_id=3,
        company_id=company.id,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)

    task.user_id = worker.id
    db.add(task)
    db.commit()

    inserted = []

    def insert_event(_db, connection, payload):
        inserted.append((connection.owner_user_id, payload["id"]))
        return {
            "id": payload["id"],
            "htmlLink": "https://calendar.google.com/event/fallback",
            "etag": "etag-fallback",
            "updated": "2026-06-15T10:00:00Z",
        }

    monkeypatch.setattr(calendar_client, "insert_event", insert_event)

    calendar_sync_service.enqueue_task_sync(db, task)
    assert calendar_sync_service.process_outbox(db, company.id)["exported"] == 1

    fallback_event_id = f"a{company.id:08x}{admin_user.id:08x}{task.id:08x}"
    assert inserted == [(admin_user.id, fallback_event_id)]
    assert db.query(TaskCalendarEvent).filter_by(
        task_id=task.id,
        user_id=admin_user.id,
    ).one().external_event_id == fallback_event_id


def test_task_sync_is_not_queued_without_google_connection(db):
    company = Company(
        name="Disconnected Company",
        tax_id="DISCONNECTED-TEST",
        address="Calle Offline 1",
        phone="600000002",
        email="offline@test.local",
    )
    db.add(company)
    db.commit()
    location = Location(
        name="Offline Location",
        address="Calle Offline 2",
        city="Madrid",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Offline task",
        unit="service",
        company_id=company.id,
        location_id=location.id,
        scheduled_start_at=datetime.now(timezone.utc),
    )
    db.add(task)
    db.commit()

    calendar_sync_service.enqueue_task_sync(db, task)

    assert db.query(CalendarSyncJob).filter_by(company_id=company.id).count() == 0


def test_import_external_google_event_creates_task(db, monkeypatch):
    company, user, connection, _ = _calendar_entities(db)

    # Mock listing events to return an event without workhive_task_id metadata
    def list_events(_db, _connection, *, sync_token, page_token=None):
        return {
            "items": [
                {
                    "id": "external-event-99",
                    "status": "confirmed",
                    "summary": "Manual Event from Google Calendar",
                    "description": "Clean the pool",
                    "updated": "2026-06-15T12:00:00Z",
                    "start": {"dateTime": "2026-06-22T08:00:00Z"},
                    "end": {"dateTime": "2026-06-22T09:00:00Z"},
                }
            ],
            "nextSyncToken": "next-sync-token-99",
        }

    patched_payloads = []
    def update_event(_db, _connection, event_id, payload):
        patched_payloads.append((event_id, payload))
        return {"id": event_id}

    monkeypatch.setattr(calendar_client, "list_events", list_events)
    monkeypatch.setattr(calendar_client, "update_event", update_event)

    imported_count = calendar_sync_service.pull_google_changes(db, company.id)
    assert imported_count == 1

    # Verify task was created in database
    task = db.query(TaskItem).filter(TaskItem.title == "Manual Event from Google Calendar").one()
    assert task.description == "Clean the pool"
    assert task.user_id == user.id  # Assigned to the connection owner
    assert task.scheduled_start_at.hour == 8

    # Verify event mapping was saved
    mapping = db.query(TaskCalendarEvent).filter_by(task_id=task.id, user_id=user.id).one()
    assert mapping.external_event_id == "external-event-99"

    # Verify Google Calendar was patched with metadata
    assert len(patched_payloads) == 1
    assert patched_payloads[0][0] == "external-event-99"
    assert patched_payloads[0][1]["extendedProperties"]["private"]["workhive_task_id"] == str(task.id)


def test_google_calendar_description_checklist_formatting():
    from app.services.calendar_sync_payload import format_description_for_google
    
    raw_desc = (
        "- [x] Limpiar suelo (@6:Victoria:progress)\n"
        "- [ ] Limpar cocina (@6:Victoria:progress)\n"
        "<!-- workhive_assignees:6 -->\n"
        "Some normal notes\n"
        "- [ ] Task without assignee\n"
    )
    
    formatted = format_description_for_google(raw_desc)
    
    expected = (
        "✅ Limpiar suelo (Victoria - en progreso)\n"
        "⬜ Limpar cocina (Victoria - en progreso)\n"
        "Some normal notes\n"
        "⬜ Task without assignee"
    )
    assert formatted.strip() == expected.strip()
