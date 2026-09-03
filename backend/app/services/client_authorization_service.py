"""Company-scoped authorization for client and commercial records."""

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User
from app.models.company_membership import CompanyMembership
from app.services import organization_authorization_service


CAPABILITY_CLIENTS_READ = "clients.read"
CAPABILITY_CLIENTS_MANAGE = "clients.manage"
CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ = "commercial.follow_ups.read"
CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE = "commercial.follow_ups.manage"


def require_client_capability(
    db: Session,
    current_user: User,
    capability: str,
) -> int:
    """Return the authorized company without accepting a client-controlled id.

    Client records do not yet have a department, team, or account-assignment
    boundary. Until those relationships exist, only a company scope grants
    access. This deliberately fails closed for narrower profile scopes.
    """

    return require_client_membership(db, current_user, capability).company_id


def require_client_membership(
    db: Session,
    current_user: User,
    capability: str,
) -> CompanyMembership:
    """Return the internal member authorized to access client records.

    A personal portfolio is meaningful only for an internal company membership;
    external grants deliberately cannot be used to enumerate it.
    """

    principal = organization_authorization_service.require_capability(
        db,
        current_user,
        capability,
        scope_type="company",
    )
    if not isinstance(principal, CompanyMembership):
        raise HTTPException(status_code=403, detail="Internal company membership required")
    return principal


def has_client_capability(
    db: Session,
    current_user: User,
    capability: str,
) -> bool:
    """Expose only the current member's effective client capabilities to UI."""

    try:
        require_client_capability(db, current_user, capability)
    except HTTPException as error:
        if error.status_code in {403, 404}:
            return False
        raise
    return True
