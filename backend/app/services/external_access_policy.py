"""Authoritative policies for people who access a company from a portal."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.repositories import external_access as external_access_repo
from app.services.entitlement_service import require_company_feature


ACCOUNTANT_ACCESS_TYPE = "accountant"
EXTERNAL_PORTAL_ROLE_NAME = "external_portal"

_ACCOUNTANT_CAPABILITIES = frozenset({"finance.read"})


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_active_accountant_grant(
    db: Session,
    *,
    company_id: int,
    user_id: int,
) -> ExternalAccessGrant | None:
    return external_access_repo.get_active_grant(
        db,
        company_id=company_id,
        user_id=user_id,
        access_type=ACCOUNTANT_ACCESS_TYPE,
        now=utcnow(),
    )


def require_external_capability(
    db: Session,
    *,
    current_user: User,
    company_id: int,
    capability: str,
) -> ExternalAccessGrant:
    """Authorize the narrow accountant portal without creating a membership."""

    if not current_user.role or current_user.role.name != EXTERNAL_PORTAL_ROLE_NAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    grant = get_active_accountant_grant(
        db,
        company_id=company_id,
        user_id=current_user.id,
    )
    if grant is None or capability not in _ACCOUNTANT_CAPABILITIES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    require_company_feature(
        db,
        company_id=company_id,
        code="features.accountant_portal",
    )
    return grant


def require_external_company_capability(
    db: Session,
    *,
    current_user: User,
    company_id: int,
    capability: str,
) -> ExternalAccessGrant | None:
    """Return an external principal when its own portal policy authorizes it."""

    if not is_external_portal_user(current_user):
        return None
    return require_external_capability(
        db,
        current_user=current_user,
        company_id=company_id,
        capability=capability,
    )


def is_external_portal_user(user: User | None) -> bool:
    return bool(user and user.role and user.role.name == EXTERNAL_PORTAL_ROLE_NAME)
