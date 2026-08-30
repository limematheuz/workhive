from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TrialRequestCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    message: str | None = Field(default=None, max_length=5000)
    requested_trial_days: int | None = Field(default=14, ge=1, le=90)
    website: str = Field(default="", max_length=200)


class TrialRequestApprove(BaseModel):
    # A trial is a Top subscription with a trialing status, never its own plan.
    access_mode: Literal["trial", "basic", "medium", "top", "mega", "custom"] = "trial"
    trial_days: int | None = Field(default=14, ge=1, le=365)
    tax_id: str = Field(min_length=3, max_length=20)
    address: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=3, max_length=20)
    company_email: EmailStr | None = None
    owner_full_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("trial_days")
    @classmethod
    def require_trial_days_for_trial(cls, value: int | None, info) -> int | None:
        access_mode = info.data.get("access_mode")
        if access_mode == "trial" and value is None:
            raise ValueError("trial_days is required for trial access")
        return value


class TrialRequestReject(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class TrialRequestResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    company_name: str
    phone: str | None = None
    message: str | None = None
    status: str
    requested_trial_days: int | None = None
    approved_trial_days: int | None = None
    approval_mode: str | None = None
    decision_note: str | None = None
    email_verified_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    approved_by_user_id: int | None = None
    created_company_id: int | None = None
    created_user_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrialRequestAccepted(BaseModel):
    status: str


class TrialRequestVerifyResponse(BaseModel):
    status: str


class TrialRequestVerify(BaseModel):
    token: str = Field(min_length=8, max_length=512)
