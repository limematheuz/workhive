"""Business rules for company access and subscription updates.

Persistence, role lookup and session invalidation remain in ``company_service``.
This module owns only the decisions that determine who can update a company and
how a platform-managed subscription transition is normalized.
"""

from collections.abc import Iterable
from fastapi import HTTPException, status

from app.models.user import User
from app.services.user_scope import is_platform_superadmin


_ACCESS_FIELDS = frozenset(
    {
        "subscription_plan",
        "subscription_status",
        "trial_started_at",
        "trial_ends_at",
    }
)
_SESSION_INVALIDATING_FIELDS = frozenset({"is_active"})


def require_company_access(
    current_user: User,
    company_id: int,
    *,
    action: str,
) -> None:
    """Allow a platform superadmin or a member of the requested company."""
    if is_platform_superadmin(current_user) or current_user.company_id == company_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Not enough permissions to {action} this company",
    )


def require_company_update_permissions(
    current_user: User,
    changed_fields: Iterable[str],
) -> None:
    """Keep access mutations inside their dedicated commercial workflow."""
    fields = set(changed_fields)
    if fields & _ACCESS_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use the platform plan and access workflow to change company access",
        )
    if is_platform_superadmin(current_user):
        return
    if "is_active" in fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a WorkHive superadmin can change company activation",
        )


def requires_session_revocation(changed_fields: Iterable[str]) -> bool:
    """Return whether a company update invalidates all member sessions."""
    return bool(set(changed_fields) & _SESSION_INVALIDATING_FIELDS)
