import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.repositories import user as user_repository
from app.schemas.calendar import CalendarOAuthStartResponse
from app.services import audit_service, calendar_sync_service


router = APIRouter()
logger = logging.getLogger(__name__)


def oauth_failure_reason(error: str | None) -> str:
    """Return a safe OAuth outcome without exposing provider details."""
    normalized_error = (error or "").strip().lower()
    if normalized_error == "access_denied":
        return "access_denied"
    if normalized_error in {"redirect_uri_mismatch", "unauthorized_client"}:
        return "provider_configuration"
    return "oauth_failed"


def _calendar_redirect(query: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/calendar?{query}")


@router.post(
    "/google/oauth/start",
    response_model=CalendarOAuthStartResponse,
)
def start_google_calendar_oauth(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    enforce_rate_limit(
        request,
        "calendar-oauth",
        settings.CALENDAR_OAUTH_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    return {
        "authorization_url": calendar_sync_service.oauth_authorization_url(
            db,
            current_user,
        )
    }


@router.get("/google/callback")
def google_calendar_callback(
    request: Request,
    code: str | None = Query(default=None, max_length=2048),
    state: str | None = Query(default=None, max_length=4096),
    error: str | None = Query(default=None, max_length=256),
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        reason = oauth_failure_reason(error)
        logger.warning("Google Calendar OAuth did not complete: %s", reason)
        return _calendar_redirect(
            urlencode({"calendar": "error", "reason": reason})
        )

    try:
        connection = calendar_sync_service.complete_oauth(db, code=code, state=state)
        actor = user_repository.get_user_by_id(
            db,
            connection.connected_by_user_id,
        )
        if actor is None:
            raise LookupError("Calendar connection actor no longer exists")
        audit_service.record_event(
            db,
            actor=actor,
            company_id=connection.company_id,
            action="calendar.connected",
            entity_type="google_calendar_connection",
            entity_id=connection.id,
            request=request,
            details={
                "google_account_email": connection.google_account_email,
                "calendar_name": connection.calendar_name,
            },
        )
        query = urlencode({"calendar": "connected"})
    except Exception:
        logger.exception("Google Calendar OAuth callback failed")
        query = urlencode({"calendar": "error", "reason": "oauth_failed"})
    return _calendar_redirect(query)
