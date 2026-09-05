from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.location_access import LocationAccessInput
from app.schemas.location_workspace import (
    LocationProfileInput,
    LocationSpaceInput,
)


class PartnerPortalGrantCreate(BaseModel):
    user_id: int


class PartnerPortalLocationCreate(BaseModel):
    """Property data a sponsored manager may own without changing its provider."""

    name: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    location_type: str | None = Field(default="private", max_length=50)
    profile: LocationProfileInput | None = None
    access: LocationAccessInput | None = None
    spaces: list[LocationSpaceInput] = Field(default_factory=list, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PartnerPortalLocationUpdate(BaseModel):
    """Whitelisted mutable property fields for a sponsored manager."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    address: str | None = Field(default=None, min_length=1, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    location_type: str | None = Field(default=None, max_length=50)
    profile: LocationProfileInput | None = None
    access: LocationAccessInput | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("name", "address", "city")
    @classmethod
    def required_when_provided(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class PartnerPortalGrantResponse(BaseModel):
    id: int
    host_company_id: int
    partner_company_id: int
    collaboration_id: int
    user_id: int
    status: str
    expires_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PartnerPortalGrantAccessResponse(PartnerPortalGrantResponse):
    """A host-facing grant plus the identity it was granted to."""

    user_full_name: str | None
    user_email: EmailStr


class PartnerPortalCandidateResponse(BaseModel):
    id: int
    full_name: str | None
    email: EmailStr
    role_name: str
    eligible: bool
    ineligible_reason: str | None = None


class PartnerPortalOverviewResponse(BaseModel):
    host_company_id: int
    host_company_name: str
    partner_company_id: int
    partner_company_name: str
    location_count: int
    upcoming_reservation_count: int
    pending_cleaning_count: int
