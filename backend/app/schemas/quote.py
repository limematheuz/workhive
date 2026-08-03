from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from app.schemas.invoice import InvoiceEmailRequest

from app.schemas.client import ClientCreate
from app.schemas.quote_item import QuoteItemCreate, QuoteItemResponse


class QuoteBase(BaseModel):
    client_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    valid_until: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)
    tax_rate: float = Field(default=0.21, ge=0, le=1)
    discount: float = Field(default=0.0, ge=0, le=100)
    equivalence_surcharge: float = Field(default=0.0, ge=0, le=100)
    retention: float = Field(default=0.0, ge=0, le=100)
    terms: str | None = Field(default=None, max_length=1000)
    shipping_address: str | None = Field(default=None, max_length=500)
    custom_issuer_info: str | None = Field(default=None, max_length=1000)
    custom_recipient_info: str | None = Field(default=None, max_length=1000)
    signature_url: str | None = Field(default=None, max_length=2048)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value


class QuoteCreate(QuoteBase):
    items: list[QuoteItemCreate] = Field(default_factory=list, max_length=200)


class QuoteUpdate(BaseModel):
    client_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = None
    valid_until: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)
    tax_rate: float | None = Field(default=None, ge=0, le=1)
    discount: float | None = Field(default=None, ge=0, le=100)
    equivalence_surcharge: float | None = Field(default=None, ge=0, le=100)
    retention: float | None = Field(default=None, ge=0, le=100)
    terms: str | None = Field(default=None, max_length=1000)
    shipping_address: str | None = Field(default=None, max_length=500)
    custom_issuer_info: str | None = Field(default=None, max_length=1000)
    custom_recipient_info: str | None = Field(default=None, max_length=1000)
    signature_url: str | None = Field(default=None, max_length=2048)
    items: list[QuoteItemCreate] | None = Field(default=None, max_length=200)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("title")
    @classmethod
    def normalize_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value


class QuoteAcceptRequest(BaseModel):
    register_client: bool = False
    client: ClientCreate | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_client_registration(self):
        if self.register_client and self.client is None:
            raise ValueError("Client details are required when registering a client")
        if not self.register_client and self.client is not None:
            raise ValueError("Client details require register_client=true")
        return self


class QuoteEmailRequest(InvoiceEmailRequest):
    pass


class QuoteResponse(QuoteBase):
    id: int
    quote_number: str
    status: str
    company_id: int
    base_amount: float
    tax_amount: float
    total_amount: float
    items: list[QuoteItemResponse]
    created_at: datetime
    updated_at: datetime
