from typing import Literal

from pydantic import BaseModel, HttpUrl


class CheckoutSessionCreate(BaseModel):
    plan: Literal["business", "pro", "lifetime"]


class HostedBillingUrl(BaseModel):
    url: HttpUrl


class SubscriptionSummary(BaseModel):
    plan: str
    status: str
    trial_ends_at: str | None = None
    access_allowed: bool
    access_reason: str
    active_users: int
    max_active_users: int | None = None
