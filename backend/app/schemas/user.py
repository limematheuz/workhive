from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, model_validator
from datetime import datetime
import re
from app.schemas.role import RoleResponse


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    photo_url: str | None = None
    is_active: bool = True
    company_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False
    policy_version: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)

    @model_validator(mode="after")
    def validate_legal_acknowledgements(self) -> "UserRegister":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError(
                "Terms and privacy notice must be explicitly accepted"
            )
        return self


class UserCreate(UserBase):
    password: str
    role_id: int | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)


class UserUpdate(BaseModel):
    full_name: str | None = None
    photo_url: str | None = None
    password: str | None = None
    old_password: str | None = None
    is_active: bool | None = None
    role_id: int | None = None
    company_id: int | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        return validate_user_password(value) if value is not None else None


class UserResponse(UserBase):
    id: int
    role_id: int
    role: RoleResponse | None = None
    company_id: int | None
    email_verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    active_location_id: int | None = None
    active_location_name: str | None = None


class UserStatsResponse(BaseModel):
    total_hours_worked: float
    tasks_completed: int
    tasks_pending: int
    total_tasks: int
    active_session_id: int | None = None
    locations_worked_count: int


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_user_password(value)


def validate_user_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must contain at least 8 characters")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must not exceed 72 UTF-8 bytes")
    if not re.search(r"[a-z]", value):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", value):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[^A-Za-z0-9]", value):
        raise ValueError("Password must contain at least one special character")
    return value
