from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.user import validate_user_password


class SponsoredPartnerInvitationCreate(BaseModel):
    email: EmailStr
    company_name: str = Field(min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SponsoredPartnerInvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    verification_code: str = Field(min_length=8, max_length=16)
    company_name: str = Field(min_length=1, max_length=100)
    tax_id: str = Field(min_length=1, max_length=20)
    address: str = Field(min_length=1, max_length=255)
    postal_code: str | None = Field(default=None, max_length=10)
    city: str | None = Field(default=None, max_length=100)
    province: str | None = Field(default=None, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    full_name: str = Field(min_length=1, max_length=100)
    password: str
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)

    @model_validator(mode="after")
    def validate_legal_acknowledgements(self) -> "SponsoredPartnerInvitationAccept":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("Terms and privacy notice must be explicitly accepted")
        return self


class SponsoredPartnerInvitationResponse(BaseModel):
    id: int
    email: EmailStr
    company_name: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SponsoredPartnerInvitationAccepted(BaseModel):
    status: str = "accepted"
