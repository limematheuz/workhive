from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.calendar_governance import (
    CalendarOwnershipRequest,
    CompanyCalendarSettings,
    PlatformCalendarConfig,
)
from app.models.company import Company
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services.user_scope import require_platform_superadmin, role_name


COMPANY_CALENDAR_VIEW_ROLES = {"admin", "manager", "viewer"}
COMPANY_CALENDAR_SYNC_ROLES = {"admin", "manager"}
COMPANY_CALENDAR_ADMIN_ROLE = "admin"


def require_company_calendar_role(user: User, allowed_roles: set[str]) -> int:
    if user.company_id is None or role_name(user) not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company calendar access is not permitted",
        )
    return user.company_id


def _platform_config(db: Session, *, lock: bool = False) -> PlatformCalendarConfig | None:
    query = db.query(PlatformCalendarConfig).filter(PlatformCalendarConfig.id == 1)
    if lock:
        query = query.with_for_update()
    return query.first()


def company_connections_enabled(db: Session) -> bool:
    config = _platform_config(db)
    return config.company_connections_enabled if config else True


def google_cloud_configured() -> bool:
    return bool(
        settings.GOOGLE_CALENDAR_CLIENT_ID
        and settings.GOOGLE_CALENDAR_CLIENT_SECRET
        and settings.GOOGLE_TOKEN_ENCRYPTION_KEY
    )


def company_calendar_available(db: Session) -> bool:
    return bool(
        settings.GOOGLE_CALENDAR_ENABLED
        and google_cloud_configured()
        and company_connections_enabled(db)
    )


def platform_status(db: Session, current_user: User) -> dict:
    require_platform_superadmin(current_user)
    config = _platform_config(db)
    tenant_enabled = config.company_connections_enabled if config else True
    connection_count = db.query(GoogleCalendarConnection).count()
    pending_requests = (
        db.query(CalendarOwnershipRequest)
        .filter(CalendarOwnershipRequest.status == "pending")
        .count()
    )
    return {
        "environment_enabled": settings.GOOGLE_CALENDAR_ENABLED,
        "google_cloud_configured": google_cloud_configured(),
        "company_connections_enabled": tenant_enabled,
        "available": bool(
            settings.GOOGLE_CALENDAR_ENABLED
            and google_cloud_configured()
            and tenant_enabled
        ),
        "redirect_uri": settings.GOOGLE_CALENDAR_REDIRECT_URI,
        "timezone": settings.GOOGLE_CALENDAR_TIMEZONE,
        "background_sync_enabled": settings.RUN_CALENDAR_BACKGROUND_SYNC,
        "connected_companies": connection_count,
        "pending_ownership_requests": pending_requests,
    }


def update_platform_status(
    db: Session,
    current_user: User,
    *,
    company_connections_enabled_value: bool,
) -> dict:
    require_platform_superadmin(current_user)
    config = _platform_config(db, lock=True)
    if not config:
        config = PlatformCalendarConfig(id=1)
    config.company_connections_enabled = company_connections_enabled_value
    config.updated_by_user_id = current_user.id
    db.add(config)
    db.commit()
    return platform_status(db, current_user)


def _active_admin_query(db: Session, company_id: int):
    return (
        db.query(User)
        .join(Role, Role.id == User.role_id)
        .filter(
            User.company_id == company_id,
            User.is_active.is_(True),
            Role.name == COMPANY_CALENDAR_ADMIN_ROLE,
        )
    )


def _resolve_company_owner(
    db: Session,
    company_id: int,
    *,
    persist: bool,
) -> User:
    if persist:
        db.query(Company).filter(Company.id == company_id).with_for_update().one()
    calendar_settings = (
        db.query(CompanyCalendarSettings)
        .filter(CompanyCalendarSettings.company_id == company_id)
        .first()
    )
    owner = None
    if calendar_settings:
        owner = _active_admin_query(db, company_id).filter(
            User.id == calendar_settings.owner_user_id
        ).first()
    if owner:
        return owner

    owner = _active_admin_query(db, company_id).order_by(User.id.asc()).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The company has no active primary administrator",
        )
    if persist:
        if not calendar_settings:
            calendar_settings = CompanyCalendarSettings(company_id=company_id)
        calendar_settings.owner_user_id = owner.id
        db.add(calendar_settings)
        db.flush()
    return owner


def require_company_calendar_owner(db: Session, current_user: User) -> User:
    company_id = require_company_calendar_role(
        current_user,
        {COMPANY_CALENDAR_ADMIN_ROLE},
    )
    owner = _resolve_company_owner(db, company_id, persist=True)
    if owner.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the primary calendar administrator can perform this action",
        )
    return owner


def require_company_calendar_available(db: Session) -> None:
    if not company_calendar_available(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar is not available for company connections",
        )


def _request_summary(request: CalendarOwnershipRequest, requester: User) -> dict:
    return {
        "id": request.id,
        "requester_user_id": requester.id,
        "requester_name": requester.full_name,
        "requester_email": requester.email,
        "status": request.status,
        "created_at": request.created_at,
    }


def company_status(db: Session, current_user: User) -> dict:
    company_id = require_company_calendar_role(
        current_user,
        COMPANY_CALENDAR_VIEW_ROLES,
    )
    owner = _resolve_company_owner(db, company_id, persist=False)
    connection = (
        db.query(GoogleCalendarConnection)
        .filter(GoogleCalendarConnection.company_id == company_id)
        .first()
    )
    current_role = role_name(current_user)
    is_admin = current_role == COMPANY_CALENDAR_ADMIN_ROLE
    is_owner = current_user.id == owner.id
    own_request = (
        db.query(CalendarOwnershipRequest)
        .filter(
            CalendarOwnershipRequest.company_id == company_id,
            CalendarOwnershipRequest.requester_user_id == current_user.id,
            CalendarOwnershipRequest.status == "pending",
        )
        .order_by(CalendarOwnershipRequest.id.desc())
        .first()
        if is_admin and not is_owner
        else None
    )
    pending = []
    if is_owner:
        rows = (
            db.query(CalendarOwnershipRequest, User)
            .join(User, User.id == CalendarOwnershipRequest.requester_user_id)
            .filter(
                CalendarOwnershipRequest.company_id == company_id,
                CalendarOwnershipRequest.status == "pending",
            )
            .order_by(CalendarOwnershipRequest.created_at.asc())
            .all()
        )
        pending = [_request_summary(request, requester) for request, requester in rows]

    available = company_calendar_available(db)
    connected = bool(connection and connection.status in {"connected", "error"})
    may_see_identity = current_role in {"admin", "manager"}
    return {
        "enabled": available,
        "configured": google_cloud_configured(),
        "connected": connected,
        "status": connection.status if connection else "disconnected",
        "user_id": current_user.id,
        "google_account_email": (
            connection.google_account_email if connection and may_see_identity else None
        ),
        "calendar_name": connection.calendar_name if connection else None,
        "last_sync_at": connection.last_sync_at if connection else None,
        "last_error": (
            connection.last_error if connection and may_see_identity else None
        ),
        "pending_jobs": (
            db.query(CalendarSyncJob)
            .filter(
                CalendarSyncJob.company_id == company_id,
                CalendarSyncJob.status.in_(["pending", "retry"]),
            )
            .count()
        ),
        "owner_user_id": owner.id,
        "owner_name": owner.full_name,
        "owner_email": owner.email if is_admin else None,
        "is_owner": is_owner,
        "can_connect": bool(available and is_owner and not connection),
        "can_disconnect": bool(is_owner and connection),
        "can_sync": bool(
            available and connected and current_role in COMPANY_CALENDAR_SYNC_ROLES
        ),
        "can_request_ownership": bool(is_admin and not is_owner and not own_request),
        "ownership_request_status": own_request.status if own_request else None,
        "pending_ownership_requests": pending,
    }


def _add_notification(
    db: Session,
    *,
    user: User,
    event_type: str,
    title: str,
    message: str,
    request_id: int,
) -> None:
    db.add(
        Notification(
            user_id=user.id,
            company_id=user.company_id,
            event_type=event_type,
            title=title,
            message=message,
            entity_type="calendar_ownership_request",
            entity_id=request_id,
            href="/dashboard/calendar",
            metadata_json={},
        )
    )


def request_ownership(db: Session, current_user: User) -> dict:
    company_id = require_company_calendar_role(
        current_user,
        {COMPANY_CALENDAR_ADMIN_ROLE},
    )
    owner = _resolve_company_owner(db, company_id, persist=True)
    if owner.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already control the company calendar connection",
        )
    existing = (
        db.query(CalendarOwnershipRequest)
        .filter(
            CalendarOwnershipRequest.company_id == company_id,
            CalendarOwnershipRequest.requester_user_id == current_user.id,
            CalendarOwnershipRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A calendar ownership request is already pending",
        )
    ownership_request = CalendarOwnershipRequest(
        company_id=company_id,
        requester_user_id=current_user.id,
    )
    try:
        db.add(ownership_request)
        db.flush()
        _add_notification(
            db,
            user=owner,
            event_type="calendar.ownership_requested",
            title="Solicitud de control del calendario",
            message=(
                f"{current_user.full_name or current_user.email} solicita "
                "conectar el calendario de la empresa."
            ),
            request_id=ownership_request.id,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A calendar ownership request is already pending",
        ) from exc
    db.refresh(ownership_request)
    return _request_summary(ownership_request, current_user)


def review_ownership_request(
    db: Session,
    current_user: User,
    request_id: int,
    *,
    approve: bool,
) -> dict:
    company_id = require_company_calendar_role(
        current_user,
        {COMPANY_CALENDAR_ADMIN_ROLE},
    )
    owner = _resolve_company_owner(db, company_id, persist=True)
    if owner.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the primary calendar administrator can review requests",
        )
    ownership_request = (
        db.query(CalendarOwnershipRequest)
        .filter(
            CalendarOwnershipRequest.id == request_id,
            CalendarOwnershipRequest.company_id == company_id,
            CalendarOwnershipRequest.status == "pending",
        )
        .with_for_update()
        .first()
    )
    if not ownership_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending calendar ownership request not found",
        )
    requester = _active_admin_query(db, company_id).filter(
        User.id == ownership_request.requester_user_id
    ).first()
    if not requester:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requesting administrator is no longer eligible",
        )
    if approve:
        has_connection = db.query(GoogleCalendarConnection.id).filter(
            GoogleCalendarConnection.company_id == company_id
        ).first()
        if has_connection:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Disconnect the current Google Calendar before transferring control",
            )
        calendar_settings = db.query(CompanyCalendarSettings).filter(
            CompanyCalendarSettings.company_id == company_id
        ).one()
        calendar_settings.owner_user_id = requester.id
        db.add(calendar_settings)
        ownership_request.status = "approved"
        other_pending = (
            db.query(CalendarOwnershipRequest)
            .filter(
                CalendarOwnershipRequest.company_id == company_id,
                CalendarOwnershipRequest.id != ownership_request.id,
                CalendarOwnershipRequest.status == "pending",
            )
            .all()
        )
        for pending in other_pending:
            pending.status = "cancelled"
            pending.reviewed_by_user_id = current_user.id
            pending.reviewed_at = datetime.now(timezone.utc)
            db.add(pending)
    else:
        ownership_request.status = "rejected"
    ownership_request.reviewed_by_user_id = current_user.id
    ownership_request.reviewed_at = datetime.now(timezone.utc)
    db.add(ownership_request)
    _add_notification(
        db,
        user=requester,
        event_type=(
            "calendar.ownership_approved"
            if approve
            else "calendar.ownership_rejected"
        ),
        title=(
            "Control del calendario aprobado"
            if approve
            else "Solicitud de calendario rechazada"
        ),
        message=(
            "Ya puedes conectar el calendario de la empresa."
            if approve
            else "El administrador principal ha rechazado la solicitud."
        ),
        request_id=ownership_request.id,
    )
    db.commit()
    db.refresh(ownership_request)
    return _request_summary(ownership_request, requester)
