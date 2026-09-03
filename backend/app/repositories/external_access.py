"""Persistence queries for external company access grants."""

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.external_access_grant import ExternalAccessGrant


def get_active_grant(
    db: Session,
    *,
    company_id: int,
    user_id: int,
    access_type: str,
    now: datetime,
) -> ExternalAccessGrant | None:
    return (
        db.query(ExternalAccessGrant)
        .filter(
            ExternalAccessGrant.company_id == company_id,
            ExternalAccessGrant.user_id == user_id,
            ExternalAccessGrant.access_type == access_type,
            ExternalAccessGrant.status == "active",
            or_(
                ExternalAccessGrant.expires_at.is_(None),
                ExternalAccessGrant.expires_at > now,
            ),
        )
        .first()
    )
