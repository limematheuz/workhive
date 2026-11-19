"""Authorization boundary for the narrow customer portal."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_portal_grant import ClientPortalGrant
from app.models.user import User
from app.repositories import client_portal as client_portal_repo
from app.services.subscription_policy import require_company_access
from app.services.entitlement_service import company_feature_enabled, require_company_feature


CLIENT_PORTAL_ROLE_NAME = "client_portal"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_active_client_portal(
    db: Session,
    *,
    current_user: User,
    grant_id: int,
) -> ClientPortalGrant:
    """Return exactly one active customer workspace, or fail closed.

    A portal user has no company membership, and no route receives a raw
    company/client selector.  The grant id is still checked against the
    authenticated user before any documents are queried.
    """

    if getattr(current_user, "application_grant_id", grant_id) != grant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if (
        not current_user.role
        or current_user.role.name != CLIENT_PORTAL_ROLE_NAME
        or current_user.company_id is not None
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    grant = client_portal_repo.get_active_grant_for_user(
        db,
        grant_id=grant_id,
        user_id=current_user.id,
        now=utcnow(),
    )
    if (
        grant is None
        or grant.company is None
        or not grant.company.is_active
        or grant.client is None
        or grant.client.company_id != grant.company_id
        or not grant.client.is_active
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    require_company_access(grant.company)
    require_company_feature(db, company_id=grant.company_id, code="features.client_portal")
    return grant


def list_active_client_portal_grants(
    db: Session,
    *,
    current_user: User,
) -> list[ClientPortalGrant]:
    if (
        not current_user.role
        or current_user.role.name != CLIENT_PORTAL_ROLE_NAME
        or current_user.company_id is not None
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    context_grant = getattr(current_user, "application_grant_id", None)
    if context_grant is not None:
        grant = client_portal_repo.get_active_grant_for_user(
            db, grant_id=context_grant, user_id=current_user.id, now=utcnow(),
        )
        grants = [grant] if grant is not None else []
    else:
        grants = client_portal_repo.list_active_grants_for_user(
            db, user_id=current_user.id, now=utcnow(),
        )
    # Several customer workspaces can belong to the same provider. Resolve its
    # entitlement once per provider rather than once per grant.
    enabled_companies = {
        company_id for company_id in {grant.company_id for grant in grants}
        if company_feature_enabled(db, company_id=company_id, code="features.client_portal")
    }
    return [
        grant
        for grant in grants
        if (
            getattr(current_user, "application_grant_id", grant.id) == grant.id
            and
            grant.company is not None
            and grant.company_id in enabled_companies
            and grant.company.is_active
            and grant.client is not None
            and grant.client.is_active
            and grant.client.company_id == grant.company_id
        )
    ]
