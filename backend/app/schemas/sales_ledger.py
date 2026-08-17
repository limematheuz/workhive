from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


PaymentStatus = Literal["paid", "pending"]
LedgerSourceType = Literal["invoice", "manual"]


def _validate_plain_text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Value cannot be empty")
    if normalized.startswith(("=", "+", "-", "@")):
        raise ValueError("Spreadsheet formulas are not allowed")
    return normalized


class SalesLedgerManualRecordBase(BaseModel):
    document_number: str = Field(min_length=1, max_length=50)
    entry_date: date
    client_name: str = Field(min_length=1, max_length=160)
    base_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    tax_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    payment_status: PaymentStatus = "pending"

    @field_validator("document_number", "client_name")
    @classmethod
    def validate_plain_text(cls, value: str) -> str:
        return _validate_plain_text(value)


class SalesLedgerManualRecordCreate(SalesLedgerManualRecordBase):
    pass


class SalesLedgerManualRecordUpdate(BaseModel):
    document_number: str | None = Field(default=None, min_length=1, max_length=50)
    entry_date: date | None = None
    client_name: str | None = Field(default=None, min_length=1, max_length=160)
    base_amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=14,
        decimal_places=2,
    )
    tax_amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=14,
        decimal_places=2,
    )
    payment_status: PaymentStatus | None = None

    @field_validator("document_number", "client_name")
    @classmethod
    def validate_optional_plain_text(cls, value: str | None) -> str | None:
        return _validate_plain_text(value) if value is not None else value


class SalesLedgerEntryResponse(BaseModel):
    source_type: LedgerSourceType
    source_id: int
    document_number: str
    entry_date: date
    client_name: str
    base_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_status: PaymentStatus
    is_editable: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_serializer("base_amount", "tax_amount", "total_amount", when_used="json")
    def serialize_money_as_number(self, value: Decimal) -> float:
        """Keep the API contract aligned with the frontend's numeric totals."""
        return float(value)


class SalesLedgerCsvError(BaseModel):
    row: int
    message: str


class SalesLedgerCsvPreview(BaseModel):
    valid_rows: int
    errors: list[SalesLedgerCsvError]


class SalesLedgerCsvImportResponse(BaseModel):
    created_count: int

    model_config = ConfigDict(from_attributes=True)
