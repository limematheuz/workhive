from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company import Company
from app.models.user import User


PLAN_ACTIVE_USER_LIMITS = {
    "free": 3,
    "trial": 5,
    "pro": 25,
}

PAYMENT_BLOCKED_STATUSES = {
    "canceled",
    "incomplete",
    "incomplete_expired",
    "inactive",
    "past_due",
    "paused",
    "unpaid",
}

SUBSCRIPTION_ERROR_MESSAGES = {
    "trial_expired": "The company trial has expired",
    "past_due": "The company subscription payment is past due",
    "unpaid": "The company subscription has an unpaid invoice",
    "canceled": "The company subscription has been canceled",
    "paused": "The company subscription is paused",
    "inactive": "The company does not have an active subscription",
    "incomplete": "The company subscription setup is incomplete",
    "incomplete_expired": "The incomplete company subscription has expired",
}


def subscription_error_code(reason: str) -> str:
    return f"subscription.{reason}"


@dataclass(frozen=True)
class SubscriptionAccess:
    allowed: bool
    reason: str


def active_user_limit(plan: str) -> int | None:
    return PLAN_ACTIVE_USER_LIMITS.get(plan)


def evaluate_company_access(
    company: Company,
    *,
    now: datetime | None = None,
) -> SubscriptionAccess:
    current_time = now or datetime.now(timezone.utc)
    trial_ends_at = company.trial_ends_at
    if trial_ends_at and trial_ends_at.tzinfo is None:
        trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)

    if company.subscription_plan == "none":
        return SubscriptionAccess(False, "inactive")

    if company.subscription_status in {"inactive", "canceled", "expired"}:
        return SubscriptionAccess(False, company.subscription_status)

    if company.subscription_status == "trialing":
        if trial_ends_at and trial_ends_at <= current_time:
            return SubscriptionAccess(False, "trial_expired")
        return SubscriptionAccess(True, "trial_active")

    if not settings.SUBSCRIPTION_ENFORCEMENT_ENABLED:
        return SubscriptionAccess(True, "enforcement_disabled")

    if company.subscription_status in {"active", "pending"}:
        return SubscriptionAccess(True, company.subscription_status)

    if company.subscription_status in PAYMENT_BLOCKED_STATUSES:
        return SubscriptionAccess(False, company.subscription_status)

    return SubscriptionAccess(False, "unknown_status")


def require_company_access(company: Company) -> None:
    access = evaluate_company_access(company)
    if access.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=SUBSCRIPTION_ERROR_MESSAGES.get(
            access.reason,
            "The company subscription does not allow access",
        ),
        headers={"X-WorkHive-Error-Code": subscription_error_code(access.reason)},
    )


def require_active_user_capacity(
    db: Session,
    company: Company,
    *,
    exclude_user_id: int | None = None,
) -> None:
    limit = active_user_limit(company.subscription_plan)
    if limit is None:
        return

    query = db.query(User).filter(
        User.company_id == company.id,
        User.is_active.is_(True),
    )
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    if query.count() >= limit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Your {company.subscription_plan} plan allows up to "
                f"{limit} active users"
            ),
        )
