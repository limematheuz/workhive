from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator

from app.core.banking import normalize_swift_bic
from app.schemas.location_access import LocationAccessInput
from app.schemas.location_workspace import (
    LocationContactInput,
    LocationProfileInput,
    LocationRiskInput,
    LocationServiceWindowInput,
    LocationSpaceInput,
)
from app.schemas.user import validate_user_password


OperatingModel = Literal["service_provider", "property_manager", "hybrid"]
ProvisionPlanCode = Literal["trial", "basic", "medium", "top", "mega", "custom"]


class CompanyBase(BaseModel):
    name: str
    tax_id: str
    address: str
    postal_code: str | None = None
    city: str | None = None
    province: str | None = None
    phone: str
    email: EmailStr
    logo: str | None = None
    bank_account: str | None = None
    swift_bic: str | None = None
    default_payment_notes: str | None = None
    default_document_terms: str | None = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

    @field_validator("swift_bic")
    @classmethod
    def validate_swift_bic(cls, value: str | None) -> str | None:
        return normalize_swift_bic(value)


class CompanyCreate(CompanyBase):
    pass


class CompanyProvisionCreate(BaseModel):
    name: str
    tax_id: str
    address: str
    postal_code: str | None = None
    city: str | None = None
    province: str | None = None
    phone: str
    email: EmailStr
    owner_full_name: str
    owner_email: EmailStr
    owner_password: str = Field(min_length=8)
    # A trial is a commercial status that always runs on Top; paid companies
    # store their actual plan code.  Keeping the distinction in this transport
    # contract prevents the old "trial/pro" selector from leaking back into
    # subscription management.
    subscription_plan: ProvisionPlanCode = "trial"
    trial_days: int | None = Field(default=14, ge=1, le=365)

    @field_validator("owner_password")
    @classmethod
    def validate_owner_password(cls, value: str) -> str:
        return validate_user_password(value)


class CompanyUpdate(BaseModel):
    name: str | None = None
    tax_id: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    province: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    logo: str | None = None
    bank_account: str | None = None
    swift_bic: str | None = None
    default_payment_notes: str | None = None
    default_document_terms: str | None = None
    is_active: bool | None = None
    onboarding_completed: bool | None = None
    # Keep legacy inputs readable for older integrations, but normalize them
    # in the service before persistence. New callers use the product plans.
    subscription_plan: Literal[
        "trial", "pro", "free", "business", "lifetime", "none",
        "basic", "medium", "top", "mega", "custom",
    ] | None = None
    subscription_status: Literal["trialing", "active", "inactive", "expired", "canceled"] | None = None
    trial_started_at: datetime | None = None
    trial_ends_at: datetime | None = None

    @field_validator("swift_bic")
    @classmethod
    def validate_swift_bic(cls, value: str | None) -> str | None:
        return normalize_swift_bic(value)


class CompanyOnboardingLocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=10)
    location_type: Literal[
        "private",
        "real_estate",
        "business",
        "exterior",
        "other",
    ]
    profile: LocationProfileInput | None = None
    access: LocationAccessInput | None = None
    spaces: list[LocationSpaceInput] = Field(default_factory=list, max_length=500)
    contacts: list[LocationContactInput] | None = Field(default=None, max_length=50)
    risks: list[LocationRiskInput] | None = Field(default=None, max_length=100)
    service_windows: list[LocationServiceWindowInput] | None = Field(default=None, max_length=50)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CompanyOnboardingComplete(BaseModel):
    operating_model: OperatingModel
    location: CompanyOnboardingLocationCreate | None = None

    model_config = ConfigDict(extra="forbid")


class CompanyOnboardingResponse(BaseModel):
    onboarding_completed: bool
    operating_model: OperatingModel
    created: bool = False
    location_id: int | None = None
    location_name: str | None = None
    template_task_id: int | None = None
    template_name: str | None = None


class CompanyResponse(CompanyBase):
    id: int
    contact_email: EmailStr | None = None
    onboarding_completed: bool
    operating_model: str | None = None
    subscription_plan: str = "none"
    subscription_status: str = "inactive"
    trial_started_at: datetime | None = None
    trial_ends_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CompanyPartnerResponse(BaseModel):
    id: int
    name: str
    tax_id: str
    address: str
    postal_code: str | None = None
    city: str | None = None
    province: str | None = None
    phone: str
    email: EmailStr
    logo: str | None = None
    is_active: bool = True
    contact_email: EmailStr | None = None

    model_config = ConfigDict(from_attributes=True)


class CompanyExpenseResponse(BaseModel):
    task_id: int
    occurred_at: datetime
    amount: float
    provider_company_id: int
    provider_company_name: str


class CompanyMemberResponse(BaseModel):
    id: int
    full_name: str | None = None
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
