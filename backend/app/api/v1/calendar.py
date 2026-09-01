from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.api.v1.calendar_oauth import router as oauth_router
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.calendar import (
    CalendarConnectionStatus,
    CalendarOwnershipRequestResponse,
    CalendarSyncResponse,
    PlatformCalendarStatus,
    PlatformCalendarUpdate,
)
from app.services import (
    audit_service,
    calendar_governance_service,
    calendar_sync_service,
)


router = APIRouter()
router.include_router(oauth_router)


@router.get("/platform/status", response_model=PlatformCalendarStatus)
def read_platform_calendar_status(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return calendar_governance_service.platform_status(db, current_user)


@router.patch("/platform/status", response_model=PlatformCalendarStatus)
def update_platform_calendar_status(
    payload: PlatformCalendarUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    result = calendar_governance_service.update_platform_status(
        db,
        current_user,
        company_connections_enabled_value=payload.company_connections_enabled,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=None,
        action="calendar.platform_availability_updated",
        entity_type="platform_calendar_config",
        entity_id=1,
        request=request,
        details={
            "company_connections_enabled": payload.company_connections_enabled,
        },
    )
    return result


@router.get("/status", response_model=CalendarConnectionStatus)
def read_calendar_status(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return calendar_governance_service.company_status(db, current_user)


@router.post(
    "/ownership-requests",
    response_model=CalendarOwnershipRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_calendar_ownership(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    enforce_rate_limit(
        request,
        "calendar-ownership",
        settings.CALENDAR_OWNERSHIP_REQUEST_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    result = calendar_governance_service.request_ownership(db, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="calendar.ownership_requested",
        entity_type="calendar_ownership_request",
        entity_id=result["id"],
        request=request,
    )
    return result


@router.post(
    "/ownership-requests/{request_id}/approve",
    response_model=CalendarOwnershipRequestResponse,
)
def approve_calendar_ownership(
    request_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    result = calendar_governance_service.review_ownership_request(
        db,
        current_user,
        request_id,
        approve=True,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="calendar.ownership_approved",
        entity_type="calendar_ownership_request",
        entity_id=request_id,
        request=request,
    )
    return result


@router.post(
    "/ownership-requests/{request_id}/reject",
    response_model=CalendarOwnershipRequestResponse,
)
def reject_calendar_ownership(
    request_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    result = calendar_governance_service.review_ownership_request(
        db,
        current_user,
        request_id,
        approve=False,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="calendar.ownership_rejected",
        entity_type="calendar_ownership_request",
        entity_id=request_id,
        request=request,
    )
    return result


@router.post("/sync", response_model=CalendarSyncResponse)
def sync_google_calendar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    enforce_rate_limit(
        request,
        "calendar-sync",
        settings.CALENDAR_SYNC_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    company_id = calendar_governance_service.require_company_calendar_role(
        db,
        current_user,
        calendar_governance_service.COMPANY_CALENDAR_SYNC_ROLES,
    )
    calendar_governance_service.require_company_calendar_available(db)
    result = calendar_sync_service.synchronize(
        db,
        company_id,
        user_id=None,
    )
    if any(result.get(key, 0) for key in ("imported", "exported", "deleted", "failed")):
        audit_service.record_event(
            db,
            actor=current_user,
            company_id=company_id,
            action="calendar.synchronized",
            entity_type="google_calendar_connection",
            entity_id=company_id,
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
    company_id = calendar_governance_service.require_company_calendar_role(
        db,
        current_user,
        {calendar_governance_service.COMPANY_CALENDAR_ADMIN_ROLE},
    )
    calendar_sync_service.disconnect(db, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company_id,
        action="calendar.disconnected",
        entity_type="google_calendar_connection",
        entity_id=company_id,
        request=request,
    )
    return {"status": "disconnected"}
