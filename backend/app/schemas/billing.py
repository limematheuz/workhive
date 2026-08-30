from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator

from app.schemas.user import validate_user_password


class CheckoutSessionCreate(BaseModel):
    # Legacy choices remain accepted during the public pricing-page migration.
    # They are converted to their canonical plan before checkout metadata is
    # persisted, so no new company keeps a legacy plan code.
    plan: Literal[
        "basic", "medium", "top", "mega",
        "business", "pro", "lifetime",
    ]


class HostedBillingUrl(BaseModel):
    url: HttpUrl


class CompanyPurchaseCheckout(BaseModel):
    """Public data collected before a new customer is redirected to Stripe."""

    plan: Literal["basic", "medium", "top", "mega"]
    company_name: str = Field(min_length=2, max_length=100)
    tax_id: str = Field(min_length=3, max_length=20)
    address: str = Field(min_length=3, max_length=255)
    postal_code: str | None = Field(default=None, max_length=10)
    city: str | None = Field(default=None, max_length=100)
    province: str | None = Field(default=None, max_length=100)
    phone: str = Field(min_length=3, max_length=20)
    company_email: EmailStr
    owner_full_name: str = Field(min_length=2, max_length=100)
    owner_email: EmailStr
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("tax_id")
    @classmethod
    def normalize_tax_id(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def require_legal_acknowledgements(self) -> "CompanyPurchaseCheckout":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("Terms and privacy notice must be explicitly accepted")
        return self


class CompanyPurchaseActivation(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    password: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)


class CompanyPurchaseActivationResponse(BaseModel):
    status: Literal["activated"]
    company_id: int


class SubscriptionSummary(BaseModel):
    plan: str
    status: str
    trial_ends_at: str | None = None
    access_allowed: bool
    access_reason: str
    active_users: int
    internal_member_limits: dict[str, int]
