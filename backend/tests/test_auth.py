from datetime import datetime, timezone

import jwt

from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User
from credentials import (
    TEST_NEW,
    TEST_OLD,
    TEST_SECRET,
    login_form,
    CREDENTIAL_FIELD,
    NEW_CREDENTIAL_FIELD,
)


def test_register_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Test User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@workhive.com"
    assert "password" not in data
    assert "hashed_password" not in data


def test_registration_notifies_the_configured_workhive_inbox(client, monkeypatch):
    from app.core.config import settings

    delivered = {}
    monkeypatch.setattr(settings, "ACCOUNT_REQUEST_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(
        settings,
        "ACCOUNT_REQUEST_RECIPIENT_EMAIL",
        "accounts@workhive.test",
    )
    monkeypatch.setattr(
        "app.services.email_service.send_account_request_notification",
        lambda **kwargs: delivered.update(kwargs) or True,
    )

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new-account-request@example.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "New Account Request",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )

    assert response.status_code == 201, response.text
    assert delivered == {
        "recipient_email": "accounts@workhive.test",
        "applicant_name": "New Account Request",
        "applicant_email": "new-account-request@example.com",
    }


def test_registration_is_not_created_when_account_request_notification_fails(
    client, db, monkeypatch
):
    from app.core.config import settings
    from app.models.user import User

    monkeypatch.setattr(settings, "ACCOUNT_REQUEST_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(
        settings,
        "ACCOUNT_REQUEST_RECIPIENT_EMAIL",
        "accounts@workhive.test",
    )
    monkeypatch.setattr(
        "app.services.email_service.send_account_request_notification",
        lambda **_: False,
    )

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "undelivered-account-request@example.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Undelivered Account Request",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )

    assert response.status_code == 503
    assert (
        db.query(User)
        .filter(User.email == "undelivered-account-request@example.com")
        .first()
        is None
    )


def test_account_request_notification_never_includes_credentials(monkeypatch):
    from app.services.email_service.access_emails import (
        send_account_request_notification,
    )

    captured = {}
    monkeypatch.setattr(
        "app.services.email_service.transport.send_email",
        lambda message: captured.update({"message": message}) or True,
    )

    assert send_account_request_notification(
        recipient_email="accounts@workhive.test",
        applicant_name="New Applicant",
        applicant_email="new-applicant@example.com",
    )

    rendered = captured["message"].as_string()
    assert "new-applicant@example.com" in rendered
    assert TEST_SECRET not in rendered
    assert "Password:" not in rendered


def test_login_user(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Test User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    response = client.post(
        "/api/v1/auth/login",
        data=login_form("test@workhive.com", TEST_SECRET),
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert response.cookies.get("auth_token")
    assert response.cookies.get("csrf_token")
    assert "HttpOnly" in response.headers["set-cookie"]


def test_every_active_role_can_login_and_read_its_session(client, db):
    company = Company(
        name="Role Access Company",
        tax_id="ROLE-ACCESS",
        address="Calle Roles 1",
        phone="600000000",
        email="roles@example.com",
        subscription_plan="pro",
        subscription_status="active",
        onboarding_completed=False,
    )
    db.add(company)
    db.flush()

    users = [
        User(
            email=f"role-access-{role_name}@example.com",
            hashed_password=get_password_hash(TEST_SECRET),
            full_name=role_name.title(),
            role_id=role_id,
            company_id=company.id,
            is_active=True,
        )
        for role_id, role_name in ((1, "admin"), (2, "manager"), (3, "viewer"))
    ]
    users.append(
        User(
            email="role-access-superadmin@example.com",
            hashed_password=get_password_hash(TEST_SECRET),
            full_name="Superadmin",
            role_id=4,
            company_id=None,
            is_active=True,
        )
    )
    db.add_all(users)
    db.commit()

    for user in users:
        login = client.post(
            "/api/v1/auth/login",
            data=login_form(user.email, TEST_SECRET),
        )
        assert login.status_code == 200, f"{user.role.name}: {login.text}"

        session = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )
        assert session.status_code == 200, f"{user.role.name}: {session.text}"
        assert session.json()["role"]["name"] == user.role.name


def test_login_session_uses_configured_seven_day_lifetime(client, monkeypatch):
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 7 * 24 * 60)
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "session-lifetime@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Session Lifetime",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )

    response = client.post(
        "/api/v1/auth/login",
        data=login_form("session-lifetime@workhive.com", TEST_SECRET),
    )

    payload = jwt.decode(
        response.json()["access_token"],
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )
    remaining_seconds = payload["exp"] - datetime.now(timezone.utc).timestamp()

    assert response.status_code == 200
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 7 * 24 * 60
    assert 7 * 24 * 60 * 60 - 5 <= remaining_seconds <= 7 * 24 * 60 * 60
    assert "Max-Age=604800" in response.headers["set-cookie"]


def test_cookie_session_requires_csrf_for_mutations(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "cookie-user@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Cookie User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("cookie-user@workhive.com", TEST_SECRET),
    )
    assert login.status_code == 200
    bearer_token = login.json()["access_token"]

    me = client.get("/api/v1/users/me")
    assert me.status_code == 200
    assert me.json()["email"] == "cookie-user@workhive.com"
    assert me.headers["cache-control"] == "private, no-store"

    csrf = client.get("/api/v1/auth/csrf")
    assert csrf.status_code == 200
    assert csrf.json()["csrf_token"] == client.cookies.get("csrf_token")

    missing_csrf = client.post("/api/v1/auth/logout")
    assert missing_csrf.status_code == 403

    csrf_token = client.cookies.get("csrf_token")
    logout = client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout.status_code == 204
    assert client.cookies.get("auth_token") is None

    revoked_token = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {bearer_token}"},
    )
    assert revoked_token.status_code == 401


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Test User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    response = client.post(
        "/api/v1/auth/login",
        data=login_form("test@workhive.com", "secret124"),
    )
    assert response.status_code == 401


def test_login_limits_identity_rotation_from_one_ip(client, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT", 1)
    with rate_limiter._lock:
        rate_limiter._attempts.clear()

    first = client.post(
        "/api/v1/auth/login",
        data=login_form("first@example.com", TEST_SECRET),
    )
    second = client.post(
        "/api/v1/auth/login",
        data=login_form("second@example.com", TEST_SECRET),
    )

    assert first.status_code == 401
    assert second.status_code == 429


def test_registration_rejects_short_and_oversized_passwords(client):
    base_payload = {
        "email": "password-policy@workhive.com",
        "full_name": "Password Policy",
        "accept_terms": True,
        "accept_privacy": True,
        "policy_version": "2026-06-15",
    }

    short = client.post(
        "/api/v1/auth/register",
        json={**base_payload, CREDENTIAL_FIELD: "short"},
    )
    oversized = client.post(
        "/api/v1/auth/register",
        json={**base_payload, CREDENTIAL_FIELD: "á" * 40},
    )

    assert short.status_code == 422
    assert oversized.status_code == 422


def test_forgot_password_does_not_reveal_if_email_exists(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent@workhive.com"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert "token" not in response.json()


def test_forgot_password_reports_unconfigured_email(client, monkeypatch):
    monkeypatch.setattr("app.services.auth_service.settings.EMAIL_ENABLED", False)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent@workhive.com"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Password recovery email is not configured"


def test_forgot_and_reset_password_flow(client, monkeypatch):
    # 1. Register a user
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "reset_user@workhive.com",
            CREDENTIAL_FIELD: TEST_OLD,
            "full_name": "Reset Test User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )

    delivered = {}

    def capture_reset_email(recipient_email, recipient_name, reset_url):
        delivered["recipient_email"] = recipient_email
        delivered["reset_url"] = reset_url
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_password_reset_email",
        capture_reset_email,
    )

    # 2. Request password reset without exposing the token in the response
    response_forgot = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "reset_user@workhive.com"},
    )
    assert response_forgot.status_code == 200
    data_forgot = response_forgot.json()
    assert data_forgot["status"] == "accepted"
    assert "token" not in data_forgot
    assert delivered["recipient_email"] == "reset_user@workhive.com"
    token = delivered["reset_url"].split("token=", 1)[1]

    # 3. Reset password using the token
    response_reset = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token,
            NEW_CREDENTIAL_FIELD: TEST_NEW,
        },
    )
    assert response_reset.status_code == 200
    assert response_reset.json()["status"] == "success"

    # 4. Attempt login with old password (should fail)
    response_login_old = client.post(
        "/api/v1/auth/login",
        data=login_form("reset_user@workhive.com", TEST_OLD),
    )
    assert response_login_old.status_code == 401

    # 5. Attempt login with new password (should succeed)
    response_login_new = client.post(
        "/api/v1/auth/login",
        data=login_form("reset_user@workhive.com", TEST_NEW),
    )
    assert response_login_new.status_code == 200
    assert "access_token" in response_login_new.json()
