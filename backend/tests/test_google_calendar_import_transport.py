import httpx

from app.integrations.google import calendar_client
from app.models.task_calendar_event import TaskCalendarEvent
from app.services import calendar_sync_service
from tests.test_google_calendar_sync import _calendar_entities


def test_import_links_metadata_with_partial_update_preserving_event_fields(
    db, monkeypatch
):
    company, _, connection, _ = _calendar_entities(db)
    event = {
        "id": "external-transport-qa",
        "status": "confirmed",
        "summary": "External QA",
        "description": "Existing Google description",
        "updated": "2026-06-15T12:00:00Z",
        "start": {"dateTime": "2026-06-22T08:00:00Z"},
        "end": {"dateTime": "2026-06-22T09:00:00Z"},
        "extendedProperties": {"private": {"external_reference": "preserve-me"}},
    }
    original = {key: event[key] for key in ["summary", "description", "start", "end"]}
    calls = []

    def request(method, url, *, params, json, headers, timeout):
        calls.append((method, json))
        if method == "PUT" and not (json.get("start") and json.get("end")):
            return httpx.Response(400, json={"error": "Missing start and end"})
        assert method == "PATCH"
        event["extendedProperties"]["private"].update(
            json["extendedProperties"]["private"]
        )
        return httpx.Response(200, json=event)

    monkeypatch.setattr(calendar_client.httpx, "request", request)
    assert calendar_sync_service._import_event(db, connection, event)
    db.commit()
    mapping = (
        db.query(TaskCalendarEvent)
        .filter_by(company_id=company.id, external_event_id=event["id"])
        .one()
    )
    assert calls[0][0] == "PATCH"
    assert event["extendedProperties"]["private"]["workhive_task_id"] == str(
        mapping.task_id
    )
    assert event["extendedProperties"]["private"]["external_reference"] == "preserve-me"
    assert {key: event[key] for key in original} == original


def test_existing_import_retries_missing_google_metadata_without_duplicate_task(
    db, monkeypatch
):
    company, _, connection, _ = _calendar_entities(db)
    event = {
        "id": "retry-external-qa",
        "status": "confirmed",
        "summary": "Retry QA",
        "updated": "2026-06-15T12:00:00Z",
        "start": {"dateTime": "2026-06-22T08:00:00Z"},
        "end": {"dateTime": "2026-06-22T09:00:00Z"},
    }
    calls = []

    def patch(_db, _connection, _id, payload):
        calls.append(payload)
        if len(calls) == 1:
            raise calendar_client.GoogleCalendarError("Temporary failure", 503)
        return payload

    monkeypatch.setattr(calendar_client, "patch_event", patch)
    assert calendar_sync_service._import_event(db, connection, event)
    db.commit()
    first = (
        db.query(TaskCalendarEvent)
        .filter_by(company_id=company.id, external_event_id=event["id"])
        .one()
    )
    task_id = first.task_id
    assert calendar_sync_service._import_event(db, connection, event)
    db.commit()
    assert len(calls) == 2
    assert calls[1]["extendedProperties"]["private"]["workhive_task_id"] == str(task_id)
    assert (
        db.query(TaskCalendarEvent)
        .filter_by(company_id=company.id, external_event_id=event["id"])
        .count()
        == 1
    )
