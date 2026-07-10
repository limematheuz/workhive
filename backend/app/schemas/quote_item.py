from datetime import datetime
from pydantic import BaseModel, ConfigDict


class QuoteItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float

    model_config = ConfigDict(from_attributes=True)


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemUpdate(BaseModel):
    description: str | None = None
    quantity: float | None = None
    unit_price: float | None = None

    model_config = ConfigDict(from_attributes=True)


class QuoteItemResponse(QuoteItemBase):
    id: int
    quote_id: int
    subtotal: float
    created_at: datetime
    updated_at: datetime
