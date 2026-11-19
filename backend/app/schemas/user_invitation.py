import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.user import validate_user_password


class UserInvitationCreate(BaseModel):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=100)
    role_id: int
    delivery: Literal["email", "link"] = "email"


class UserInvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    code: str = Field(min_length=8, max_length=8)
    password: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not re.fullmatch(r"\d{8}", value):
            raise ValueError("Verification code must contain 8 digits")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        return validate_user_password(value) if value is not None else None

    @model_validator(mode="after")
    def validate_legal_acknowledgements(self) -> "UserInvitationAccept":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("Terms and privacy notice must be explicitly accepted")
        return self


class UserInvitationAccepted(BaseModel):
    status: str = "accepted"


class UserInvitationCreated(BaseModel):
    status: str = "accepted"
    delivery: Literal["email", "link"]
    email: EmailStr
    expires_at: datetime
    invitation_url: str | None = None
    verification_code: str | None = None


class UserInvitationResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role_id: int
    role_name: str
    status: str
    expires_at: datetime
    created_at: datetime
    rejoin_existing_identity: bool
