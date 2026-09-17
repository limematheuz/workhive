from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.subscription_terms import (
    CommercialSubscriptionTermsInput,
    CommercialSubscriptionTermsResponse,
)


PlanCode = Literal["basic", "medium", "top", "mega", "custom"]
PlanStatus = Literal[
    "trialing",
    "active",
    "pending",
    "past_due",
    "unpaid",
    "paused",
    "canceled",
    "expired",
    "inactive",
    "incomplete",
    "incomplete_expired",
]


class CompanyPlanAccessUpdate(BaseModel):
    plan_code: PlanCode
    status: PlanStatus
    trial_ends_at: datetime | None = None
    commercial_terms: CommercialSubscriptionTermsInput | None = None
    reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("trial_ends_at")
    @classmethod
    def normalize_trial_end(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value)

    @model_validator(mode="after")
    def validate_trial(self):
        if self.plan_code == "custom":
            raise ValueError(
                "Use the company customization endpoint for a custom configuration"
            )
        if self.status == "trialing":
            if self.plan_code != "top":
                raise ValueError("Trials always use the Top plan")
            if self.trial_ends_at is None:
                raise ValueError("A trial end date is required")
            if self.commercial_terms is not None:
                raise ValueError("Trials cannot have paid commercial terms")
        elif self.trial_ends_at is not None:
            raise ValueError("Only trial access can have a trial end date")
        elif self.status == "active" and self.commercial_terms is None:
            raise ValueError("Active subscriptions require commercial terms")
        elif self.status != "active" and self.commercial_terms is not None:
            raise ValueError("Only active subscriptions can record commercial terms")
        return self


class CompanyEntitlementOverrideCreate(BaseModel):
    code: str = Field(min_length=1, max_length=120)
    boolean_value: bool | None = None
    integer_value: int | None = Field(default=None, ge=0)
    ends_at: datetime | None = None
    reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("ends_at")
    @classmethod
    def normalize_override_end(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value)

    @model_validator(mode="after")
    def validate_single_value(self):
        if (self.boolean_value is None) == (self.integer_value is None):
            raise ValueError("Provide exactly one exception value")
        return self


class EntitlementValueUpdate(BaseModel):
    """One explicit entitlement value used by plan and company configurators."""

    code: str = Field(min_length=1, max_length=120)
    boolean_value: bool | None = None
    integer_value: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_single_value(self):
        if (self.boolean_value is None) == (self.integer_value is None):
            raise ValueError("Provide exactly one entitlement value")
        return self


class CompanyEntitlementCustomizationUpdate(BaseModel):
    """Replace the active company-specific configuration in one transaction."""

    entitlements: list[EntitlementValueUpdate] = Field(min_length=1)
    reason: str = Field(min_length=3, max_length=500)
    ends_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("ends_at")
    @classmethod
    def normalize_end(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value)


class PlanCatalogUpdate(BaseModel):
    """Publish the next version of a standard plan."""

    entitlements: list[EntitlementValueUpdate] = Field(min_length=1)
    reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class EntitlementResponse(BaseModel):
    code: str
    label: str
    group: str
    value_type: Literal["boolean", "integer"]
    value: bool | int
    source: Literal["plan", "exception"]
    availability: Literal["available", "platform_internal", "coming_soon"]


class PlanCatalogResponse(BaseModel):
    code: PlanCode
    label: str
    version: int
    entitlements: list[EntitlementResponse]


class CompanySubscriptionAccessResponse(BaseModel):
    plan_code: PlanCode
    plan_label: str
    plan_version: int | None = None
    status: PlanStatus
    trial_ends_at: datetime | None = None
    commercial_terms: CommercialSubscriptionTermsResponse | None = None


class CompanyEntitlementOverrideResponse(BaseModel):
    id: int
    code: str
    label: str
    group: str
    value_type: Literal["boolean", "integer"]
    value: bool | int
    reason: str
    starts_at: datetime
    ends_at: datetime | None = None


class EntitlementAuditResponse(BaseModel):
    id: int
    action: str
    reason: str | None = None
    created_at: datetime


class CompanyEntitlementUsageResponse(BaseModel):
    administrators: int
    managers: int
    workers: int
    departments: int
    teams: int


class CompanyPlanAccessResponse(BaseModel):
    company_id: int
    subscription: CompanySubscriptionAccessResponse
    entitlements: list[EntitlementResponse]
    base_entitlements: list[EntitlementResponse]
    overrides: list[CompanyEntitlementOverrideResponse]
    audit: list[EntitlementAuditResponse]
    usage: CompanyEntitlementUsageResponse


class CurrentCompanyEntitlementsResponse(BaseModel):
    entitlements: list[EntitlementResponse]


class CommercialPlanOverviewResponse(BaseModel):
    """Current subscription lifecycle counts grouped by effective plan."""

    code: PlanCode
    label: str
    active_subscriptions: int
    trial_subscriptions: int
    payment_attention_subscriptions: int
    inactive_subscriptions: int
    contracted_mrr_cents: int
    subscriptions_without_commercial_terms: int


class CommercialOverviewResponse(BaseModel):
    """Platform-only lifecycle metrics, deliberately separate from tenant finance."""

    active_subscriptions: int
    trial_subscriptions: int
    payment_attention_subscriptions: int
    upgrades_last_30_days: int
    downgrades_last_30_days: int
    churned_last_30_days: int
    revenue_measurement_available: bool
    contracted_mrr_cents: int
    active_subscriptions_without_commercial_terms: int
    plans: list[CommercialPlanOverviewResponse]
