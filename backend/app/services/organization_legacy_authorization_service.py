"""Temporary compatibility policy for members without permission profiles."""

from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.user import User
from app.repositories import organization as organization_repo
from app.services.user_scope import role_name


_LEGACY_ROLE_CAPABILITIES = {
    "admin": frozenset(
        {
            "access.members.read", "access.members.manage", "locations.read",
            "locations.manage", "work.read", "work.manage", "time.read",
            "time.manage", "time.approve", "finance.read", "finance.manage",
        }
    ),
    "manager": frozenset(
        {
            "locations.read", "locations.manage", "work.read", "work.manage",
            "time.read", "time.manage", "time.approve",
        }
    ),
    "viewer": frozenset(
        {"locations.read", "work.read", "time.read", "time.manage"}
    ),
}


def has_explicit_profile_assignments(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> bool:
    return organization_repo.has_profile_assignment_history(
        db, company_id=company_id, membership_id=membership_id
    )


def legacy_role_allows(
    db: Session,
    current_user: User,
    capability: str,
    *,
    company_id: int,
    membership: CompanyMembership,
    has_explicit_assignments: bool | None = None,
) -> bool:
    """Preserve legacy operational roles until they receive an explicit profile.

    This applies only to the newly protected operational domains. Existing
    client and commercial authorization remains strict-profile-only. Any past
    or current profile assignment disables this bridge, including after a
    revocation. Removing permission must never restore a broader legacy role.
    """

    if capability not in _LEGACY_ROLE_CAPABILITIES.get(role_name(current_user), ()):
        return False
    if membership.permissions_configured:
        return False
    if has_explicit_assignments is None:
        has_explicit_assignments = has_explicit_profile_assignments(
            db, company_id=company_id, membership_id=membership.id
        )
    return not has_explicit_assignments
