from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClientBase(BaseModel):
    name: str = Field(max_length=100)
    client_type: Literal["individual", "business", "company"] = "individual"
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str = Field(max_length=255)
    city: str = Field(max_length=100)
    province: str | None = Field(default=None, max_length=100)
    postal_code: str = Field(max_length=10)
    country: str = Field(max_length=100)
    legal_number: str | None = Field(default=None, max_length=20)
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

    @field_validator("phone", "province", "legal_number")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ClientCreate(ClientBase):
    company_id: int | None = None

    @field_validator("name", "address", "city", "postal_code", "country")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    client_type: Literal["individual", "business", "company"] | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, min_length=1, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    province: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, min_length=1, max_length=10)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    legal_number: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None

    @field_validator(
        "name",
        "phone",
        "address",
        "city",
        "province",
        "postal_code",
        "country",
        "legal_number",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ClientEmailRequest(BaseModel):
    recipient_emails: list[EmailStr] = Field(min_length=1, max_length=20)
    copy_emails: list[EmailStr] = Field(default_factory=list, max_length=20)
    subject: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=2000)
    send_copy: bool = False
    save_recipients: bool = False
    save_recipient_to_client_id: int | None = Field(default=None, gt=0)
    locale: Literal["es", "en"] = "es"


class ClientResponse(ClientBase):
    id: int
    company_id: int
