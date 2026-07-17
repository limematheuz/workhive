from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode
from uuid import uuid4

import httpx
import jwt
from cryptography.fernet import InvalidToken
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.google.token_crypto import decrypt_token, encrypt_token
from app.models.google_calendar_connection import GoogleCalendarConnection


AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"  # nosec B105
USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar",
]


class GoogleCalendarError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def create_oauth_state(*, company_id: int, user_id: int) -> str:
    payload = {
        "company_id": company_id,
        "user_id": user_id,
        "type": "google_calendar_oauth",
        "jti": uuid4().hex,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_oauth_state(state: str) -> dict:
    payload = jwt.decode(
        state,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )
    if payload.get("type") != "google_calendar_oauth":
        raise ValueError("Invalid Google Calendar OAuth state")
    if not payload.get("jti"):
        raise ValueError("Invalid Google Calendar OAuth state")
    return payload


def authorization_url(*, company_id: int, user_id: int) -> str:
    if not settings.GOOGLE_CALENDAR_CLIENT_ID:
        raise ValueError("Google Calendar OAuth client is not configured")
    return f"{AUTHORIZATION_ENDPOINT}?{
        urlencode(
            {
                'client_id': settings.GOOGLE_CALENDAR_CLIENT_ID,
                'redirect_uri': settings.GOOGLE_CALENDAR_REDIRECT_URI,
                'response_type': 'code',
                'scope': ' '.join(SCOPES),
                'access_type': 'offline',
                'prompt': 'consent',
                'include_granted_scopes': 'true',
                'state': create_oauth_state(company_id=company_id, user_id=user_id),
            }
        )
    }"


def exchange_authorization_code(code: str) -> dict:
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CALENDAR_CLIENT_ID,
            "client_secret": settings.GOOGLE_CALENDAR_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_CALENDAR_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if response.is_error:
        raise GoogleCalendarError(
            f"Google OAuth exchange failed: {response.text[:500]}",
            response.status_code,
        )
    return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.GOOGLE_CALENDAR_CLIENT_ID,
            "client_secret": settings.GOOGLE_CALENDAR_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if response.is_error:
        raise GoogleCalendarError(
            f"Google token refresh failed: {response.text[:500]}",
            response.status_code,
        )
    return response.json()


def _access_token(
    db: Session,
    connection: GoogleCalendarConnection,
) -> str:
    now = datetime.now(timezone.utc)
    expires_at = connection.token_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at > now + timedelta(minutes=2):
        try:
            return decrypt_token(connection.access_token_encrypted)
        except InvalidToken as exc:
            raise GoogleCalendarError(
                "Google Calendar authorization must be reconnected",
                401,
            ) from exc
    if not connection.refresh_token_encrypted:
        raise GoogleCalendarError("Google refresh token is unavailable")
    try:
        refresh_token = decrypt_token(connection.refresh_token_encrypted)
    except InvalidToken as exc:
        raise GoogleCalendarError(
            "Google Calendar authorization must be reconnected",
            401,
        ) from exc
    refreshed = refresh_access_token(refresh_token)
    access_token = refreshed["access_token"]
    connection.access_token_encrypted = encrypt_token(access_token)
    connection.token_expires_at = now + timedelta(
        seconds=int(refreshed.get("expires_in", 3600))
    )
    db.add(connection)
    db.commit()
    return access_token


def _request(
    db: Session,
    connection: GoogleCalendarConnection,
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json: dict | None = None,
) -> dict:
    token = _access_token(db, connection)
    response = httpx.request(
        method,
        f"{CALENDAR_API}{path}",
        params=params,
        json=json,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if response.status_code == 401 and connection.refresh_token_encrypted:
        connection.token_expires_at = None
        token = _access_token(db, connection)
        response = httpx.request(
            method,
            f"{CALENDAR_API}{path}",
            params=params,
            json=json,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    if response.is_error:
        raise GoogleCalendarError(
            f"Google Calendar API failed: {response.text[:1000]}",
            response.status_code,
        )
    return response.json() if response.content else {}


def google_account_email(access_token: str) -> str | None:
    response = httpx.get(
        USERINFO_ENDPOINT,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("email")


def create_calendar(
    access_token: str,
    *,
    summary: str,
) -> dict:
    response = httpx.post(
        f"{CALENDAR_API}/calendars",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "summary": summary,
            "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE,
        },
        timeout=30,
    )
    if response.is_error:
        raise GoogleCalendarError(
            f"Could not create the WorkHive calendar: {response.text[:1000]}",
            response.status_code,
        )
    return response.json()


def list_events(
    db: Session,
    connection: GoogleCalendarConnection,
    *,
    sync_token: str | None,
    page_token: str | None = None,
) -> dict:
    params = {
        "showDeleted": "true",
        "singleEvents": "true",
        "maxResults": "2500",
    }
    if sync_token:
        params["syncToken"] = sync_token
    if page_token:
        params["pageToken"] = page_token
    return _request(
        db,
        connection,
        "GET",
        f"/calendars/{quote(connection.calendar_id, safe='')}/events",
        params=params,
    )


def insert_event(
    db: Session,
    connection: GoogleCalendarConnection,
    payload: dict,
) -> dict:
    calendar_id = quote(connection.calendar_id, safe="")
    return _request(
        db,
        connection,
        "POST",
        f"/calendars/{calendar_id}/events",
        json=payload,
    )


def update_event(
    db: Session,
    connection: GoogleCalendarConnection,
    event_id: str,
    payload: dict,
) -> dict:
    calendar_id = quote(connection.calendar_id, safe="")
    encoded_event = quote(event_id, safe="")
    return _request(
        db,
        connection,
        "PUT",
        f"/calendars/{calendar_id}/events/{encoded_event}",
        json={key: value for key, value in payload.items() if key != "id"},
    )


def delete_event(
    db: Session,
    connection: GoogleCalendarConnection,
    event_id: str,
) -> None:
    calendar_id = quote(connection.calendar_id, safe="")
    encoded_event = quote(event_id, safe="")
    _request(
        db,
        connection,
        "DELETE",
        f"/calendars/{calendar_id}/events/{encoded_event}",
    )
