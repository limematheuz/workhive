"""Transport contracts for manual bank-statement reconciliation."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _TrimmedTextModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class BankStatementEntryCreate(_TrimmedTextModel):
    booked_at: datetime
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    account_label: str | None = Field(default=None, max_length=100)
    external_id: str | None = Field(default=None, max_length=160)
    reference: str | None = Field(default=None, max_length=160)
    counterparty: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=10_000)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.upper()
        if not normalized.isalpha():
            raise ValueError("La divisa debe ser un código ISO de tres letras")
        return normalized


class BankReconciliationMatch(BaseModel):
    customer_payment_id: int = Field(gt=0)


class BankReconciliationReverse(_TrimmedTextModel):
    reason: str = Field(min_length=1, max_length=1_000)


class ReconciledCustomerPaymentResponse(BaseModel):
    id: int
    client_id: int
    received_at: datetime
    amount: Decimal
    reference: str | None
    status: Literal["received", "voided"]

    model_config = ConfigDict(from_attributes=True)


class BankReconciliationResponse(BaseModel):
    id: int
    customer_payment_id: int
    status: Literal["matched", "reversed"]
    matched_at: datetime
    matched_by_user_id: int | None
    reversed_at: datetime | None
    reversed_by_user_id: int | None
    reversal_reason: str | None
    payment: ReconciledCustomerPaymentResponse

    model_config = ConfigDict(from_attributes=True)


class BankStatementEntryResponse(BaseModel):
    id: int
    booked_at: datetime
    amount: Decimal
    currency: str
    account_label: str | None
    external_id: str | None
    reference: str | None
    counterparty: str | None
    notes: str | None
    status: Literal["unmatched", "matched"]
    created_by_user_id: int | None
    created_at: datetime
    current_reconciliation: BankReconciliationResponse | None

    model_config = ConfigDict(from_attributes=True)
