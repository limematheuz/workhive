from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD, NEW_CREDENTIAL_FIELD


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
