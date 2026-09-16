"""Transport contracts for immutable commercial subscription terms."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


BillingInterval = Literal["monthly", "annual"]
TaxBehavior = Literal["exclusive", "inclusive"]


class CommercialSubscriptionTermsInput(BaseModel):
    """The agreed price and cadence for one paid subscription period."""

    billing_interval: BillingInterval
    amount_cents: int = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)
    tax_behavior: TaxBehavior
    effective_at: datetime

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.upper()
        if not normalized.isalpha():
            raise ValueError("Currency must be a three-letter ISO code")
        if normalized != "EUR":
            raise ValueError("WorkHive commercial terms currently support EUR only")
        return normalized

    @field_validator("effective_at")
    @classmethod
    def normalize_effective_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class CommercialSubscriptionTermsResponse(CommercialSubscriptionTermsInput):
    """Current immutable commercial terms, when an auditable record exists."""
