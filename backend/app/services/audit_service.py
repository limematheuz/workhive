import logging
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.request_context import get_client_ip
from app.services.user_scope import is_platform_superadmin


logger = logging.getLogger(__name__)
TRAFFIC_ACTIONS = ("auth.login", "public.page_view")


def purge_previous_month_traffic(db: Session) -> int:
    cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    deleted = (
        db.query(AuditLog)
        .filter(
            AuditLog.action.in_(TRAFFIC_ACTIONS),
            AuditLog.created_at < cutoff,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def record_event(
    db: Session,
    *,
    actor: User,
    company_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    request: Request,
    details: dict | None = None,
) -> None:
    try:
        event = AuditLog(
            actor_user_id=actor.id,
            company_id=company_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            request_id=getattr(request.state, "request_id", None),
            ip_address=get_client_ip(request),
            details=details or {},
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Could not persist audit event",
            extra={
                "request_id": getattr(request.state, "request_id", None),
            },
        )


def record_public_event(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    request: Request,
    details: dict | None = None,
) -> None:
    try:
        event = AuditLog(
            actor_user_id=None,
            company_id=None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            request_id=getattr(request.state, "request_id", None),
            ip_address=get_client_ip(request),
            details=details or {},
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Could not persist public audit event",
            extra={
                "request_id": getattr(request.state, "request_id", None),
            },
        )


def record_api_key_event(
    db: Session,
    *,
    company_id: int,
    api_key_id: int,
    api_key_prefix: str,
    scope: str,
    request: Request,
) -> None:
    """Audit an authenticated public API request without retaining its secret."""

    try:
        event = AuditLog(
            actor_user_id=None,
            company_id=company_id,
            action="api_access_key.used",
            entity_type="api_access_key",
            entity_id=str(api_key_id),
            request_id=getattr(request.state, "request_id", None),
            ip_address=get_client_ip(request),
            details={
                "api_key_prefix": api_key_prefix,
                "scope": scope,
                "method": request.method,
                "path": request.url.path,
            },
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Could not persist public API audit event",
            extra={"request_id": getattr(request.state, "request_id", None)},
        )


def list_events(
    db: Session,
    current_user: User,
    *,
    company_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[AuditLog]:
    if is_platform_superadmin(current_user):
        purge_previous_month_traffic(db)

    query = db.query(AuditLog)
    if is_platform_superadmin(current_user):
        if company_id is not None:
            query = query.filter(AuditLog.company_id == company_id)
    else:
        query = query.filter(AuditLog.company_id == current_user.company_id)
    return (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(skip)
        .limit(min(limit, 500))
        .all()
    )
