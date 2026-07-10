from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.quote_item import QuoteItemResponse


class QuoteBase(BaseModel):
    client_id: int | None = None
    title: str
    valid_until: datetime | None = None
    notes: str | None = None
    tax_rate: float = 0.21
    discount: float = 0.0
    equivalence_surcharge: float = 0.0
    retention: float = 0.0
    terms: str | None = None
    shipping_address: str | None = None
    custom_issuer_info: str | None = None
    custom_recipient_info: str | None = None
    signature_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class QuoteCreate(QuoteBase):
    pass


class QuoteUpdate(BaseModel):
    client_id: int | None = None
    title: str | None = None
    status: str | None = None
    valid_until: datetime | None = None
    notes: str | None = None
    tax_rate: float | None = None
    discount: float | None = None
    equivalence_surcharge: float | None = None
    retention: float | None = None
    terms: str | None = None
    shipping_address: str | None = None
    custom_issuer_info: str | None = None
    custom_recipient_info: str | None = None
    signature_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


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
