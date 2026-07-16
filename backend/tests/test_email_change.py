import json

import pytest

from app.core.rate_limit import rate_limiter
from app.core.security import create_password_reset_token
from app.models.audit_log import AuditLog
from app.repositories import user as user_repo


PASSWORD = "CurrentPass1!"
NEW_EMAIL = "matheus@workhive.es"


@pytest.fixture(autouse=True)
def reset_email_change_rate_limits():
    with rate_limiter._lock:
        rate_limiter._attempts.clear()
    yield
    with rate_limiter._lock:
        rate_limiter._attempts.clear()


def _register(client, email: str, password: str = PASSWORD):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Email Change User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert response.status_code == 201
    return response.json()


def _login(client, email: str, password: str = PASSWORD) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def _capture_delivery(monkeypatch) -> dict[str, str]:
    delivered: dict[str, str] = {}

    def capture_verification(**kwargs):
        delivered.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_email_change_verification_email",
        capture_verification,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_email_changed_notice",
        lambda **kwargs: True,
    )
    return delivered


def _request_change(client, login: dict, new_email: str = NEW_EMAIL):
    return client.post(
        "/api/v1/auth/request-email-change",
        headers={"X-CSRF-Token": login["csrf_token"]},
        json={"new_email": new_email, "current_password": PASSWORD},
    )


def _delivered_token(delivered: dict[str, str]) -> str:
    return delivered["confirmation_url"].split("#token=", 1)[1]


def test_email_changes_only_after_new_address_is_verified(client, db, monkeypatch):
    original_email = "owner@workhive.com"
    registered = _register(client, original_email)
    login = _login(client, original_email)
    delivered = _capture_delivery(monkeypatch)

    requested = _request_change(client, login, "  MATHEUS@WORKHIVE.ES ")

    assert requested.status_code == 202
    assert delivered["recipient_email"] == NEW_EMAIL
    assert "/confirm-email-change#token=" in delivered["confirmation_url"]
    assert "/confirm-email-change?token=" not in delivered["confirmation_url"]
    assert user_repo.get_user_by_id(db, registered["id"]).email == original_email
    request_event = (
        db.query(AuditLog)
        .filter(AuditLog.action == "auth.email_change_requested")
        .one()
    )
    assert PASSWORD not in json.dumps(request_event.details)
    assert "token" not in json.dumps(request_event.details).lower()

    token = _delivered_token(delivered)
    confirmed = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": token},
    )

    assert confirmed.status_code == 200
    changed_user = user_repo.get_user_by_id(db, registered["id"])
    assert changed_user.email == NEW_EMAIL
    assert changed_user.email_verified_at is not None
    assert changed_user.session_version == 1
    assert client.cookies.get("auth_token") is None
    assert client.cookies.get("csrf_token") is None
    confirmation_event = (
        db.query(AuditLog)
        .filter(AuditLog.action == "auth.email_changed")
        .one()
    )
    assert token not in json.dumps(confirmation_event.details)

    revoked = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    assert revoked.status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        data={"username": original_email, "password": PASSWORD},
    ).status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        data={"username": NEW_EMAIL, "password": PASSWORD},
    ).status_code == 200


def test_email_change_requires_current_password(client, monkeypatch):
    _register(client, "password-check@workhive.com")
    login = _login(client, "password-check@workhive.com")
    delivered = _capture_delivery(monkeypatch)

    response = client.post(
        "/api/v1/auth/request-email-change",
        headers={"X-CSRF-Token": login["csrf_token"]},
        json={"new_email": NEW_EMAIL, "current_password": "WrongPass1!"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"
    assert delivered == {}


def test_email_change_rejects_existing_or_current_email(client, monkeypatch):
    _register(client, "first@workhive.com")
    _register(client, "existing@workhive.com")
    login = _login(client, "first@workhive.com")
    _capture_delivery(monkeypatch)

    duplicate = _request_change(client, login, "EXISTING@WORKHIVE.COM")
    same = _request_change(client, login, "FIRST@WORKHIVE.COM")

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Email already registered"
    assert same.status_code == 400


def test_email_change_request_requires_csrf_for_cookie_session(client, monkeypatch):
    _register(client, "csrf-email@workhive.com")
    _login(client, "csrf-email@workhive.com")
    _capture_delivery(monkeypatch)

    response = client.post(
        "/api/v1/auth/request-email-change",
        json={"new_email": NEW_EMAIL, "current_password": PASSWORD},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid or missing CSRF token"


def test_email_change_confirmation_is_single_use(client, monkeypatch):
    _register(client, "single-use@workhive.com")
    login = _login(client, "single-use@workhive.com")
    delivered = _capture_delivery(monkeypatch)
    assert _request_change(client, login).status_code == 202
    token = _delivered_token(delivered)

    first = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": token},
    )
    second = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": token},
    )

    assert first.status_code == 200
    assert second.status_code == 400


def test_email_change_rejects_stale_session_token(client, db, monkeypatch):
    registered = _register(client, "stale-email@workhive.com")
    login = _login(client, "stale-email@workhive.com")
    delivered = _capture_delivery(monkeypatch)
    assert _request_change(client, login).status_code == 202
    user = user_repo.get_user_by_id(db, registered["id"])
    user.session_version += 1
    db.commit()

    response = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": _delivered_token(delivered)},
    )

    assert response.status_code == 400
    assert user_repo.get_user_by_id(db, registered["id"]).email == "stale-email@workhive.com"


def test_email_change_rechecks_uniqueness_during_confirmation(client, monkeypatch):
    _register(client, "race-owner@workhive.com")
    login = _login(client, "race-owner@workhive.com")
    delivered = _capture_delivery(monkeypatch)
    assert _request_change(client, login).status_code == 202
    _register(client, NEW_EMAIL)

    response = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": _delivered_token(delivered)},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_email_change_rejects_wrong_token_purpose(client):
    response = client.post(
        "/api/v1/auth/confirm-email-change",
        json={"token": create_password_reset_token("owner@workhive.com")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The email change link is invalid or has expired"


def test_email_change_validates_address_and_delivery_configuration(
    client,
    monkeypatch,
):
    _register(client, "validation@workhive.com")
    login = _login(client, "validation@workhive.com")

    invalid = client.post(
        "/api/v1/auth/request-email-change",
        headers={"X-CSRF-Token": login["csrf_token"]},
        json={"new_email": "not-an-email", "current_password": PASSWORD},
    )
    monkeypatch.setattr(
        "app.services.email_change_service.settings.EMAIL_ENABLED",
        False,
    )
    unavailable = _request_change(client, login)

    assert invalid.status_code == 422
    assert unavailable.status_code == 503
