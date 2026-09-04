"""Authorization boundary for a sponsored property-manager portal."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_collaboration import CompanyCollaboration
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.user import User
from app.repositories import partner_portal as partner_portal_repo
from app.services.entitlement_service import require_company_feature
from app.services.subscription_policy import require_company_access


PARTNER_PORTAL_ROLE_NAME = "partner_portal"
PARTNER_PORTAL_FEATURE_CODE = "features.partner_portal"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def collaboration_companies(
    collaboration: CompanyCollaboration,
) -> tuple[int, int]:
    """Return the paying service provider and the property manager.

    ``role_type`` always describes ``partner_company_id``. The same accepted
    relationship can therefore originate in either company without changing
    the portal's commercial direction.
    """

    if collaboration.role_type == "property_manager":
        return collaboration.initiator_company_id, collaboration.partner_company_id
    if collaboration.role_type == "service_provider":
        return collaboration.partner_company_id, collaboration.initiator_company_id
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="The collaboration has an unsupported operational role.",
    )


def require_active_partner_portal(
    db: Session,
    *,
    current_user: User,
) -> PartnerPortalGrant:
    """Authorize only a live, sponsored property-manager relationship.

    The recipient company deliberately does not need an active subscription:
    access is paid for by the host company and must disappear when the grant,
    collaboration, host entitlement, or host subscription ceases to be valid.
    """

    if (
        not current_user.role
        or current_user.role.name != PARTNER_PORTAL_ROLE_NAME
        or current_user.company_id is None
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    grant = partner_portal_repo.get_active_grant_for_user(
        db,
        user_id=current_user.id,
        now=utcnow(),
    )
    if grant is None or grant.partner_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    collaboration = grant.collaboration
    if collaboration is None or collaboration.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    host_company_id, partner_company_id = collaboration_companies(collaboration)
    if (
        host_company_id != grant.host_company_id
        or partner_company_id != grant.partner_company_id
        or grant.host_company is None
        or not grant.host_company.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    require_company_access(grant.host_company)
    require_company_feature(
        db,
        company_id=grant.host_company_id,
        code=PARTNER_PORTAL_FEATURE_CODE,
    )
    return grant
