from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.core.security import create_access_token
from app.integrations.google import calendar_client
from app.models.user import User
from app.services.organization_bootstrap_service import ensure_user_membership


def test_oauth_callback_sync_and_disconnect_with_provider_transport_stub(
    client, api_workspace, monkeypatch
):
    qa = api_workspace
    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_CLIENT_ID", "qa-client")
    monkeypatch.setattr(
        settings, "GOOGLE_CALENDAR_CLIENT_SECRET", "qa-provider-simulation-only"
    )
    monkeypatch.setattr(
        calendar_client,
        "exchange_authorization_code",
        lambda code: {
            "access_token": "qa-access-token",
            "refresh_token": "qa-refresh-token",
            "expires_in": 3600,
        },
    )
    monkeypatch.setattr(
        calendar_client, "google_account_email", lambda token: "qa-calendar@example.com"
    )
    monkeypatch.setattr(
        calendar_client,
        "create_calendar",
        lambda token, **kwargs: {"id": "qa-isolated-calendar"},
    )
    monkeypatch.setattr(
        calendar_client,
        "list_events",
        lambda *args, **kwargs: {"items": [], "nextSyncToken": "qa-sync"},
    )
    headers = qa.headers["admin"]
    started = client.post("/api/v1/calendar/google/oauth/start", headers=headers)
    assert started.status_code == 200, started.text
    state = parse_qs(urlparse(started.json()["authorization_url"]).query)["state"][0]
    callback = client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "qa-provider-code", "state": state},
        follow_redirects=False,
    )
    assert (
        callback.status_code == 307
        and "calendar=connected" in callback.headers["location"]
    ), callback.text
    assert (
        client.get("/api/v1/calendar/status", headers=headers).json()["connected"]
        is True
    )
    synced = client.post("/api/v1/calendar/sync", headers=headers)
    assert synced.status_code == 200 and synced.json()["failed"] == 0, synced.text
    assert (
        client.delete(
            "/api/v1/calendar/google", headers=qa.headers["outsider"]
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/calendar/status", headers=headers).json()["connected"]
        is True
    )
    disconnected = client.delete("/api/v1/calendar/google", headers=headers)
    assert (
        disconnected.status_code == 200
        and disconnected.json()["status"] == "disconnected"
    ), disconnected.text
    assert (
        client.get("/api/v1/calendar/status", headers=headers).json()["connected"]
        is False
    )
    replayed = client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "qa-provider-code", "state": state},
        follow_redirects=False,
    )
    assert (
        replayed.status_code == 307 and "calendar=error" in replayed.headers["location"]
    )
    assert (
        client.get("/api/v1/calendar/status", headers=headers).json()["connected"]
        is False
    )


def test_calendar_owner_can_reject_another_admins_request(client, db, api_workspace):
    qa = api_workspace
    assert (
        client.get("/api/v1/calendar/status", headers=qa.headers["admin"]).status_code
        == 200
    )
    user = User(
        email="calendar-requester@example.com",
        full_name="QA alternate admin",
        hashed_password="unused",
        role_id=qa.admin.role_id,
        company_id=qa.company.id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    ensure_user_membership(db, user)
    db.commit()
    headers = {
        "Authorization": "Bearer "
        + create_access_token({"sub": user.email, "ver": user.session_version})
    }
    requested = client.post("/api/v1/calendar/ownership-requests", headers=headers)
    assert requested.status_code == 202, requested.text
    path = f"/api/v1/calendar/ownership-requests/{requested.json()['id']}/reject"
    assert client.post(path, headers=qa.headers["outsider"]).status_code in {403, 404}
    rejected = client.post(path, headers=qa.headers["admin"])
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected", (
        rejected.text
    )
