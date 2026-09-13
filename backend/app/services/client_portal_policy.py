"""Authorization boundary for the document-only customer portal."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_portal_grant import ClientPortalGrant
from app.models.user import User
from app.repositories import client_portal as client_portal_repo
from app.services.subscription_policy import require_company_access


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
    grants = client_portal_repo.list_active_grants_for_user(
        db,
        user_id=current_user.id,
        now=utcnow(),
    )
    return [
        grant
        for grant in grants
        if (
            grant.company is not None
            and grant.company.is_active
            and grant.client is not None
            and grant.client.is_active
            and grant.client.company_id == grant.company_id
        )
    ]
