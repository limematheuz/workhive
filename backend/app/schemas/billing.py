from typing import Literal

from pydantic import BaseModel, HttpUrl


class CheckoutSessionCreate(BaseModel):
    # Legacy choices remain accepted during the public pricing-page migration.
    # They are converted to their canonical plan before checkout metadata is
    # persisted, so no new company keeps a legacy plan code.
    plan: Literal[
        "basic", "medium", "top", "mega",
        "business", "pro", "lifetime",
    ]
    billing_interval: Literal["monthly", "annual"] = "monthly"


class HostedBillingUrl(BaseModel):
    url: HttpUrl


class SubscriptionSummary(BaseModel):
    plan: str
    status: str
    trial_ends_at: str | None = None
    access_allowed: bool
    access_reason: str
    active_users: int
    internal_member_limits: dict[str, int]
