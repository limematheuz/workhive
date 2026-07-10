from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class InvoiceItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(default=1.0, gt=0)
    unit_price: float
    tax_rate: float = Field(default=0.21, ge=0, le=1)
    task_item_id: int | None = None
    model_config = ConfigDict(from_attributes=True)

class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=500)
    quantity: float | None = Field(default=None, gt=0)
    unit_price: float | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=1)
    task_item_id: int | None = None


class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int
    subtotal: float
    total: float
    created_at: datetime
    updated_at: datetime
