from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.security import create_access_token
from app.integrations.google.token_crypto import encrypt_token
from app.integrations.google import calendar_client
from app.models.calendar_governance import (
    CalendarOwnershipRequest,
    CompanyCalendarSettings,
)
from app.models.company import Company
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.notification import Notification
from app.models.user import User
from app.services import calendar_sync_service


@pytest.fixture(autouse=True)
def calendar_configuration(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_CALENDAR_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(
        settings,
        "GOOGLE_CALENDAR_CLIENT_SECRET",
        "test-client-secret",
    )
    monkeypatch.setattr(
        settings,
        "GOOGLE_TOKEN_ENCRYPTION_KEY",
        "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
    )
    with rate_limiter._lock:
        rate_limiter._attempts.clear()
    yield
    with rate_limiter._lock:
        rate_limiter._attempts.clear()


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Calendar {suffix}",
        tax_id=f"CAL-{suffix}",
        address=f"Calendar Street {suffix}",
        phone=f"60000{suffix:0>4}",
        email=f"company-{suffix}@example.com",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(
    db,
    *,
    email: str,
    role_id: int,
    company_id: int | None,
) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@", 1)[0].replace(".", " ").title(),
        role_id=role_id,
        company_id=company_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _connection(db, company: Company, owner: User) -> GoogleCalendarConnection:
    connection = GoogleCalendarConnection(
        company_id=company.id,
        connected_by_user_id=owner.id,
        owner_user_id=owner.id,
        google_account_email=f"google-{company.id}@example.test",
        calendar_id=f"company-calendar-{company.id}",
        calendar_name=f"WorkHive - {company.name}",
        access_token_encrypted=encrypt_token("access-token"),
        refresh_token_encrypted=encrypt_token("refresh-token"),
        token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def test_platform_panel_is_superadmin_only_and_never_exposes_secrets(
    client,
    db,
):
    company = _company(db, "platform")
    admin = _user(
        db,
        email="admin-platform@example.test",
        role_id=1,
        company_id=company.id,
    )
    superadmin = _user(
        db,
        email="platform@example.test",
        role_id=4,
        company_id=None,
    )

    denied = client.get(
        "/api/v1/calendar/platform/status",
        headers=_headers(admin),
    )
    assert denied.status_code == 403

    response = client.get(
        "/api/v1/calendar/platform/status",
        headers=_headers(superadmin),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["google_cloud_configured"] is True
    assert payload["available"] is True
    serialized = str(payload).lower()
    assert "client_secret" not in serialized
    assert "test-client-secret" not in serialized
    assert "encryption" not in serialized
    assert "token" not in serialized

    updated = client.patch(
        "/api/v1/calendar/platform/status",
        headers=_headers(superadmin),
        json={"company_connections_enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["company_connections_enabled"] is False
    assert updated.json()["available"] is False


def test_platform_status_and_company_detail_are_available_together(client, db):
    company = _company(db, "status-company")
    superadmin = _user(
        db,
        email="status-superadmin@example.test",
        role_id=4,
        company_id=None,
    )
    headers = _headers(superadmin)

    platform_response = client.get(
        "/api/v1/calendar/platform/status",
        headers=headers,
    )
    company_response = client.get(
        f"/api/v1/companies/{company.id}",
        headers=headers,
    )

    assert platform_response.status_code == 200
    assert company_response.status_code == 200
    assert company_response.json()["id"] == company.id
    assert company_response.json()["email"] == company.email


def test_platform_superadmin_has_no_company_calendar_access(client, db):
    superadmin = _user(
        db,
        email="calendar-superadmin@example.test",
        role_id=4,
        company_id=None,
    )
    headers = _headers(superadmin)

    assert client.get("/api/v1/calendar/status", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/v1/calendar/google/oauth/start",
            headers=headers,
        ).status_code
        == 403
    )
    assert client.post("/api/v1/calendar/sync", headers=headers).status_code == 403
    assert client.delete("/api/v1/calendar/google", headers=headers).status_code == 403


def test_only_primary_admin_can_connect_and_other_admin_requests_control(
    client,
    db,
):
    company = _company(db, "owners")
    primary = _user(
        db,
        email="primary@example.test",
        role_id=1,
        company_id=company.id,
    )
    secondary = _user(
        db,
        email="secondary@example.test",
        role_id=1,
        company_id=company.id,
    )
    manager = _user(
        db,
        email="manager@example.test",
        role_id=2,
        company_id=company.id,
    )
    viewer = _user(
        db,
        email="viewer@example.test",
        role_id=3,
        company_id=company.id,
    )

    primary_status = client.get(
        "/api/v1/calendar/status",
        headers=_headers(primary),
    )
    assert primary_status.status_code == 200
    assert primary_status.json()["is_owner"] is True
    assert primary_status.json()["can_connect"] is True

    secondary_status = client.get(
        "/api/v1/calendar/status",
        headers=_headers(secondary),
    ).json()
    assert secondary_status["is_owner"] is False
    assert secondary_status["can_request_ownership"] is True
    assert secondary_status["owner_email"] == primary.email

    assert (
        client.post(
            "/api/v1/calendar/google/oauth/start",
            headers=_headers(secondary),
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/calendar/ownership-requests",
            headers=_headers(manager),
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/calendar/sync",
            headers=_headers(viewer),
        ).status_code
        == 403
    )

    requested = client.post(
        "/api/v1/calendar/ownership-requests",
        headers=_headers(secondary),
    )
    assert requested.status_code == 202
    request_id = requested.json()["id"]
    assert (
        db.query(Notification)
        .filter(
            Notification.user_id == primary.id,
            Notification.entity_id == request_id,
        )
        .one()
    )
    duplicate = client.post(
        "/api/v1/calendar/ownership-requests",
        headers=_headers(secondary),
    )
    assert duplicate.status_code == 409

    review_status = client.get(
        "/api/v1/calendar/status",
        headers=_headers(primary),
    ).json()
    assert [item["id"] for item in review_status["pending_ownership_requests"]] == [
        request_id
    ]

    approved = client.post(
        f"/api/v1/calendar/ownership-requests/{request_id}/approve",
        headers=_headers(primary),
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert (
        db.query(CompanyCalendarSettings)
        .filter(CompanyCalendarSettings.company_id == company.id)
        .one()
        .owner_user_id
        == secondary.id
    )
    assert (
        client.get(
            "/api/v1/calendar/status",
            headers=_headers(secondary),
        ).json()["can_connect"]
        is True
    )
    assert (
        client.get(
            "/api/v1/calendar/status",
            headers=_headers(primary),
        ).json()["can_connect"]
        is False
    )


def test_ownership_reviews_and_status_are_tenant_isolated(client, db):
    first_company = _company(db, "tenant-a")
    second_company = _company(db, "tenant-b")
    first_owner = _user(
        db,
        email="owner-a@example.test",
        role_id=1,
        company_id=first_company.id,
    )
    first_requester = _user(
        db,
        email="requester-a@example.test",
        role_id=1,
        company_id=first_company.id,
    )
    second_owner = _user(
        db,
        email="owner-b@example.test",
        role_id=1,
        company_id=second_company.id,
    )
    _connection(db, second_company, second_owner)

    requested = client.post(
        "/api/v1/calendar/ownership-requests",
        headers=_headers(first_requester),
    )
    assert requested.status_code == 202
    request_id = requested.json()["id"]

    foreign_review = client.post(
        f"/api/v1/calendar/ownership-requests/{request_id}/approve",
        headers=_headers(second_owner),
    )
    assert foreign_review.status_code == 404
    db.expire_all()
    assert db.get(CalendarOwnershipRequest, request_id).status == "pending"

    first_status = client.get(
        "/api/v1/calendar/status",
        headers=_headers(first_owner),
    ).json()
    second_status = client.get(
        "/api/v1/calendar/status",
        headers=_headers(second_owner),
    ).json()
    assert first_status["connected"] is False
    assert first_status["google_account_email"] is None
    assert second_status["connected"] is True
    assert second_status["google_account_email"] == (
        f"google-{second_company.id}@example.test"
    )


def test_company_database_allows_only_one_google_connection(db):
    company = _company(db, "unique")
    owner = _user(
        db,
        email="unique-owner@example.test",
        role_id=1,
        company_id=company.id,
    )
    other_admin = _user(
        db,
        email="unique-other@example.test",
        role_id=1,
        company_id=company.id,
    )
    _connection(db, company, owner)
    db.add(
        GoogleCalendarConnection(
            company_id=company.id,
            connected_by_user_id=other_admin.id,
            owner_user_id=other_admin.id,
            calendar_id="duplicate-calendar",
            calendar_name="Duplicate",
            access_token_encrypted=encrypt_token("duplicate"),
        )
    )

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_transfer_requires_explicit_disconnect(client, db):
    company = _company(db, "disconnect")
    primary = _user(
        db,
        email="disconnect-primary@example.test",
        role_id=1,
        company_id=company.id,
    )
    secondary = _user(
        db,
        email="disconnect-secondary@example.test",
        role_id=1,
        company_id=company.id,
    )
    requested = client.post(
        "/api/v1/calendar/ownership-requests",
        headers=_headers(secondary),
    )
    assert requested.status_code == 202
    _connection(db, company, primary)

    response = client.post(
        (f"/api/v1/calendar/ownership-requests/{requested.json()['id']}/approve"),
        headers=_headers(primary),
    )
    assert response.status_code == 409
    assert "Disconnect" in response.json()["detail"]


def test_oauth_callback_rechecks_current_company_owner(db, monkeypatch):
    company = _company(db, "oauth-owner")
    primary = _user(
        db,
        email="oauth-primary@example.test",
        role_id=1,
        company_id=company.id,
    )
    secondary = _user(
        db,
        email="oauth-secondary@example.test",
        role_id=1,
        company_id=company.id,
    )
    db.add(
        CompanyCalendarSettings(
            company_id=company.id,
            owner_user_id=primary.id,
        )
    )
    db.commit()
    authorization_url = calendar_client.authorization_url(
        company_id=company.id,
        user_id=secondary.id,
    )
    state = authorization_url.split("state=", 1)[1].split("&", 1)[0]
    exchange_called = False

    def exchange_authorization_code(_code):
        nonlocal exchange_called
        exchange_called = True
        return {}

    monkeypatch.setattr(
        calendar_client,
        "exchange_authorization_code",
        exchange_authorization_code,
    )

    with pytest.raises(HTTPException) as error:
        calendar_sync_service.complete_oauth(db, code="code", state=state)

    assert error.value.status_code == 403
    assert exchange_called is False
