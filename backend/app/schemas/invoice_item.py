from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InvoiceItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(default=1.0, gt=0)
    unit_price: float
    tax_rate: float = Field(default=0.21, ge=0, le=1)
    task_item_id: int | None = Field(default=None, gt=0)
    model_config = ConfigDict(from_attributes=True)


class InvoiceItemCreate(InvoiceItemBase):
    unit_price: float = Field(ge=0)


class RectificationInvoiceItemCreate(InvoiceItemBase):
    unit_price: float = Field(le=0)


class InvoiceItemUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=500)
    quantity: float | None = Field(default=None, gt=0)
    unit_price: float | None = Field(default=None, ge=0)
    tax_rate: float | None = Field(default=None, ge=0, le=1)
    task_item_id: int | None = Field(default=None, gt=0)


class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int
    subtotal: float
    total: float
    created_at: datetime
    updated_at: datetime
