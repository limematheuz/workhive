import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.calendar import (
    CalendarConnectionStatus,
    CalendarOAuthStartResponse,
    CalendarSyncResponse,
)
from app.services import audit_service, calendar_sync_service


router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status", response_model=CalendarConnectionStatus)
def read_calendar_status(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return calendar_sync_service.connection_status(
        db,
        current_user.company_id,
        current_user.id,
        include_company_connections=current_user.role.name in {"admin", "manager"},
    )


@router.post(
    "/google/oauth/start",
    response_model=CalendarOAuthStartResponse,
)
def start_google_calendar_oauth(
    current_user: User = ActiveUser,
):
    return {
        "authorization_url": (
            calendar_sync_service.oauth_authorization_url(current_user)
        )
    }


@router.get("/google/callback")
def google_calendar_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        query = urlencode({"calendar": "error", "reason": error or "missing_code"})
        return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/calendar?{query}")
    try:
        connection = calendar_sync_service.complete_oauth(
            db,
            code=code,
            state=state,
        )
        actor = db.query(User).filter(
            User.id == connection.connected_by_user_id
        ).one()
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
    return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/calendar?{query}")


@router.post("/sync", response_model=CalendarSyncResponse)
def sync_google_calendar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    result = calendar_sync_service.synchronize(
        db,
        current_user.company_id,
        user_id=None,
    )
    if any(result.get(key, 0) for key in ("imported", "exported", "deleted", "failed")):
        audit_service.record_event(
            db,
            actor=current_user,
            company_id=current_user.company_id,
            action="calendar.synchronized",
            entity_type="google_calendar_connection",
            entity_id=current_user.company_id,
            request=request,
            details={
                key: value
                for key, value in result.items()
                if key != "last_sync_at"
            },
        )
    return result


@router.delete("/google")
def disconnect_google_calendar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    calendar_sync_service.disconnect(db, current_user.company_id, current_user.id)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="calendar.disconnected",
        entity_type="google_calendar_connection",
        entity_id=current_user.company_id,
        request=request,
    )
    return {"status": "disconnected"}
