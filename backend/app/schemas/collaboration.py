from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.company import CompanyPartnerResponse


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

    mode: Literal["requires_subscription", "sign_in"]


class CompanyCollaborationInvitationCodeVerification(BaseModel):
    """The invited email is revealed only after its verification code is valid."""

    email: EmailStr


class CompanyCollaborationInvitationResponse(BaseModel):
    id: int
    email: str
    role_type: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
