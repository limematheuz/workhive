"""API contracts for customer receipts and invoice allocations."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.invoice import InvoicePaymentMethod


class _TrimmedTextModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class CustomerPaymentAllocationCreate(BaseModel):
    invoice_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class CustomerPaymentCreate(_TrimmedTextModel):
    client_id: int = Field(gt=0)
    received_at: datetime
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    payment_method: InvoicePaymentMethod | None = None
    reference: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=10_000)
    allocations: list[CustomerPaymentAllocationCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_allocations(self):
        invoice_ids = [allocation.invoice_id for allocation in self.allocations]
        if len(invoice_ids) != len(set(invoice_ids)):
            raise ValueError("Una factura solo puede aparecer una vez por cobro")
        allocated = sum((allocation.amount for allocation in self.allocations), Decimal("0"))
        if allocated > self.amount:
            raise ValueError("Los repartos no pueden superar el importe cobrado")
        return self


class CustomerPaymentVoid(_TrimmedTextModel):
    reason: str = Field(min_length=1, max_length=1_000)


class CustomerPaymentAllocationResponse(BaseModel):
    id: int
    invoice_id: int
    amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerPaymentResponse(BaseModel):
    id: int
    client_id: int
    received_at: datetime
    amount: Decimal
    payment_method: InvoicePaymentMethod | None
    reference: str | None
    notes: str | None
    status: Literal["received", "voided"]
    created_by_user_id: int | None
    voided_at: datetime | None
    voided_by_user_id: int | None
    void_reason: str | None
    created_at: datetime
    allocations: list[CustomerPaymentAllocationResponse]
    allocated_amount: Decimal
    unapplied_amount: Decimal

    model_config = ConfigDict(from_attributes=True)
