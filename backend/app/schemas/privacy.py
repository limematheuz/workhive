from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PrivacyRequestType = Literal[
    "access",
    "rectification",
    "erasure",
    "restriction",
    "portability",
    "objection",
]


class PrivacyRequestCreate(BaseModel):
    request_type: PrivacyRequestType
    reason: str | None = Field(default=None, max_length=2000)


class PrivacyRequestResolve(BaseModel):
    decision: Literal["complete", "reject"]
    resolution_notes: str = Field(min_length=3, max_length=4000)


class PrivacyRequestResponse(BaseModel):
    id: int
    company_id: int | None
    requested_by_user_id: int | None
    request_type: PrivacyRequestType
    status: str
    reason: str | None
    resolution_notes: str | None
    resolved_by_user_id: int | None
    requested_at: datetime
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PrivacyConsentResponse(BaseModel):
    id: int
    consent_type: str
    policy_version: str
    accepted: bool
    created_at: datetime
    withdrawn_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
