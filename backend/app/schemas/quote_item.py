from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class QuoteItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(default=1.0, gt=0)
    unit_price: float = Field(ge=0)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Description cannot be blank")
        return value


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=500)
    quantity: float | None = Field(default=None, gt=0)
    unit_price: float | None = Field(default=None, ge=0)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("description")
    @classmethod
    def normalize_optional_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Description cannot be blank")
        return value


class QuoteItemResponse(QuoteItemBase):
    id: int
    quote_id: int
    subtotal: float
    created_at: datetime
    updated_at: datetime
