from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator

from app.schemas.user import validate_user_password


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
    default_payment_notes: str | None = None
    default_document_terms: str | None = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


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
    subscription_plan: Literal["trial", "pro"] = "trial"
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
    default_payment_notes: str | None = None
    default_document_terms: str | None = None
    is_active: bool | None = None
    onboarding_completed: bool | None = None
    subscription_plan: Literal["trial", "pro", "none"] | None = None
    subscription_status: Literal["trialing", "active", "inactive", "expired", "canceled"] | None = None
    trial_started_at: datetime | None = None
    trial_ends_at: datetime | None = None


class CompanyResponse(CompanyBase):
    id: int
    contact_email: EmailStr | None = None
    onboarding_completed: bool
    partner_code: str | None = None
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
