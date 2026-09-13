"""Bounded audit-log queries used by administrative domain services."""

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def list_api_key_usage(
    db: Session,
    *,
    company_id: int,
    api_key_id: int,
    limit: int,
) -> list[AuditLog]:
    return (
        db.query(AuditLog)
        .filter(
            AuditLog.company_id == company_id,
            AuditLog.action == "api_access_key.used",
            AuditLog.entity_type == "api_access_key",
            AuditLog.entity_id == str(api_key_id),
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )
