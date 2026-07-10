from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExpenseBase(BaseModel):
    expense_date: datetime
    vendor: str | None = Field(default=None, max_length=160)
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=255)
    payment_method: str | None = Field(default=None, max_length=60)
    base_amount: float = Field(ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    receipt_url: str | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    expense_date: datetime | None = None
    vendor: str | None = Field(default=None, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    payment_method: str | None = Field(default=None, max_length=60)
    base_amount: float | None = Field(default=None, ge=0)
    tax_amount: float | None = Field(default=None, ge=0)
    receipt_url: str | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ExpenseResponse(ExpenseBase):
    id: int
    company_id: int
    created_by_user_id: int | None
    total_amount: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
