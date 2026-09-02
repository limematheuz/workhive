from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClientBase(BaseModel):
    name: str = Field(max_length=100)
    client_type: Literal["individual", "business", "company"] = "individual"
    relationship_status: Literal["lead", "client"] = "client"
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
    relationship_status: Literal["lead", "client"] | None = None
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


class ClientAccessResponse(BaseModel):
    can_read_clients: bool
    can_manage_clients: bool
    can_read_commercial_follow_ups: bool
    can_manage_commercial_follow_ups: bool


ClientContactRoleCode = Literal[
    "commercial",
    "billing",
    "operations",
    "quality",
    "emergency",
    "general",
]


class ClientContactBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=120)
    roles: list[ClientContactRoleCode] = Field(default_factory=list, max_length=6)
    is_primary: bool = False
    is_active: bool = True

    @field_validator("full_name", "phone", "job_title")
    @classmethod
    def normalize_contact_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("roles")
    @classmethod
    def normalize_roles(cls, values: list[ClientContactRoleCode]) -> list[ClientContactRoleCode]:
        if len(values) != len(set(values)):
            raise ValueError("Each contact responsibility can only be selected once")
        return values


class ClientContactCreate(ClientContactBase):
    pass


class ClientContactUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=120)
    roles: list[ClientContactRoleCode] | None = Field(default=None, max_length=6)
    is_primary: bool | None = None
    is_active: bool | None = None

    @field_validator("full_name", "phone", "job_title")
    @classmethod
    def normalize_optional_contact_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("roles")
    @classmethod
    def normalize_optional_roles(
        cls, values: list[ClientContactRoleCode] | None
    ) -> list[ClientContactRoleCode] | None:
        if values is not None and len(values) != len(set(values)):
            raise ValueError("Each contact responsibility can only be selected once")
        return values


class ClientContactResponse(ClientContactBase):
    id: int
    client_id: int
    roles: list[ClientContactRoleCode] = Field(validation_alias="role_codes")

    model_config = ConfigDict(from_attributes=True)
