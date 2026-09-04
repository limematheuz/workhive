"""Persistence queries for sponsored partner portals."""

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.partner_portal_grant import PartnerPortalGrant


def get_active_grant_for_user(
    db: Session,
    *,
    user_id: int,
    now: datetime,
) -> PartnerPortalGrant | None:
    return (
        db.query(PartnerPortalGrant)
        .options(
            joinedload(PartnerPortalGrant.host_company),
            joinedload(PartnerPortalGrant.partner_company),
            joinedload(PartnerPortalGrant.collaboration),
        )
        .filter(
            PartnerPortalGrant.user_id == user_id,
            PartnerPortalGrant.status == "active",
            or_(
                PartnerPortalGrant.expires_at.is_(None),
                PartnerPortalGrant.expires_at > now,
            ),
        )
        .order_by(PartnerPortalGrant.id.asc())
        .first()
    )


def get_grant_for_collaboration_user(
    db: Session,
    *,
    collaboration_id: int,
    user_id: int,
) -> PartnerPortalGrant | None:
    return (
        db.query(PartnerPortalGrant)
        .filter(
            PartnerPortalGrant.collaboration_id == collaboration_id,
            PartnerPortalGrant.user_id == user_id,
        )
        .first()
    )
