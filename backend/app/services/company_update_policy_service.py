"""Business rules for company access and subscription updates.

Persistence, role lookup and session invalidation remain in ``company_service``.
This module owns only the decisions that determine who can update a company and
how a platform-managed subscription transition is normalized.
"""

from collections.abc import Iterable
from datetime import datetime, timezone

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
_SESSION_INVALIDATING_FIELDS = _ACCESS_FIELDS | {"is_active"}


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
    """Keep platform-only company activation and subscription fields protected."""
    fields = set(changed_fields)
    if is_platform_superadmin(current_user):
        return
    if "is_active" in fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a WorkHive superadmin can change company activation",
        )
    if fields & _ACCESS_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a WorkHive superadmin can change company access",
        )


def normalize_platform_subscription_update(
    update_payload: dict,
    *,
    platform_superadmin: bool,
    now: datetime | None = None,
) -> dict:
    """Return the canonical access state for an explicitly changed plan."""
    if not platform_superadmin or "subscription_plan" not in update_payload:
        return update_payload

    normalized_payload = update_payload.copy()
    plan = normalized_payload["subscription_plan"]
    if plan == "trial":
        normalized_payload.update(
            subscription_plan="top",
            subscription_status="trialing",
            trial_started_at=now or datetime.now(timezone.utc),
        )
    elif plan == "none":
        normalized_payload.update(
            subscription_status="inactive",
            trial_started_at=None,
            trial_ends_at=None,
        )
    else:
        legacy_plan_map = {
            "free": "basic",
            "business": "medium",
            "pro": "top",
            "lifetime": "top",
        }
        normalized_payload["subscription_plan"] = legacy_plan_map.get(plan, plan)
        normalized_payload.update(
            subscription_status="active",
            trial_started_at=None,
            trial_ends_at=None,
        )
    return normalized_payload


def requires_session_revocation(changed_fields: Iterable[str]) -> bool:
    """Return whether a company update invalidates all member sessions."""
    return bool(set(changed_fields) & _SESSION_INVALIDATING_FIELDS)
