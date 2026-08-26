from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.schemas.company import CompanyPartnerResponse
from app.schemas.user import validate_user_password


class CollaborationResponse(BaseModel):
    id: int
    initiator_company_id: int
    partner_company_id: int
    status: str
    role_type: str
    created_at: datetime
    updated_at: datetime
    initiator: CompanyPartnerResponse
    partner: CompanyPartnerResponse

    model_config = ConfigDict(from_attributes=True)


class CompanyCollaborationInvitationCreate(BaseModel):
    email: EmailStr
    role_type: Literal["service_provider", "property_manager"] = "service_provider"


class CompanyCollaborationInvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    verification_code: str = Field(min_length=8, max_length=16)


class CompanyCollaborationInvitationAccessCheck(BaseModel):
    """Token-only check used before showing the verification step."""

    token: str = Field(min_length=32, max_length=128)


class CompanyCollaborationInvitationActivationStatus(BaseModel):
    """Safe token-scoped guidance for the acceptance screen."""

    mode: Literal["create_account", "sign_in"]


class CompanyCollaborationInvitationCodeVerification(BaseModel):
    """The invited email is revealed only after its verification code is valid."""

    email: EmailStr


class CompanyCollaborationInvitationActivate(BaseModel):
    """Create the invited company's first administrator and accept the invitation."""

    token: str = Field(min_length=32, max_length=128)
    verification_code: str = Field(min_length=8, max_length=16)
    full_name: str = Field(min_length=1, max_length=100)
    company_name: str = Field(min_length=1, max_length=100)
    tax_id: str = Field(min_length=1, max_length=20)
    address: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=20)
    password: str
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)

    @model_validator(mode="after")
    def validate_legal_acknowledgements(self) -> "CompanyCollaborationInvitationActivate":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("Terms and privacy notice must be explicitly accepted")
        return self


class CompanyCollaborationInvitationActivateExistingAccount(BaseModel):
    """Attach an already registered, company-less account to the invited company."""

    token: str = Field(min_length=32, max_length=128)
    verification_code: str = Field(min_length=8, max_length=16)
    company_name: str = Field(min_length=1, max_length=100)
    tax_id: str = Field(min_length=1, max_length=20)
    address: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=20)


class CompanyCollaborationInvitationActivated(BaseModel):
    status: Literal["accepted"] = "accepted"


class CompanyCollaborationInvitationResponse(BaseModel):
    id: int
    email: str
    role_type: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
