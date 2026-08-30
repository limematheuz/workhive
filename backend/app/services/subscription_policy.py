from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from app.core.config import settings
from app.models.company import Company

PAYMENT_BLOCKED_STATUSES = {
    "canceled",
    "incomplete",
    "incomplete_expired",
    "inactive",
    "pending",
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
    "pending": "The company payment is awaiting confirmation",
    "incomplete": "The company subscription setup is incomplete",
    "incomplete_expired": "The incomplete company subscription has expired",
}


def subscription_error_code(reason: str) -> str:
    return f"subscription.{reason}"


@dataclass(frozen=True)
class SubscriptionAccess:
    allowed: bool
    reason: str


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

    if company.subscription_status == "active":
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
