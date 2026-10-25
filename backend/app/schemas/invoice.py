from app.schemas.invoice_item import InvoiceItemResponse
from app.schemas.invoice_item import InvoiceItemCreate
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


InvoicePaymentMethod = Literal[
    "bank_transfer",
    "direct_debit",
    "card",
    "cash",
    "bizum",
    "other",
]


class InvoiceBase(BaseModel):
    client_id: int = Field(gt=0)
    issue_date: datetime
    due_date: datetime | None = None
    invoice_number: str | None = Field(default=None, max_length=50)
    discount: float = Field(default=0.0, ge=0, le=100)
    equivalence_surcharge: float = Field(default=0.0, ge=0, le=100)
    retention: float = Field(default=0.0, ge=0, le=100)
    payment_method: InvoicePaymentMethod | None = "bank_transfer"
    notes: str | None = None
    terms: str | None = None
    shipping_address: str | None = None
    custom_issuer_info: str | None = None
    custom_recipient_info: str | None = None
    signature_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceDraftCreate(InvoiceCreate):
    items: list[InvoiceItemCreate] = Field(min_length=1)


class InvoiceUpdate(BaseModel):
    client_id: int | None = Field(default=None, gt=0)
    issue_date: datetime | None = None
    due_date: datetime | None = None
    invoice_number: str | None = Field(default=None, max_length=50)
    status: str | None = None
    discount: float | None = Field(default=None, ge=0, le=100)
    equivalence_surcharge: float | None = Field(default=None, ge=0, le=100)
    retention: float | None = Field(default=None, ge=0, le=100)
    payment_method: InvoicePaymentMethod | None = None
    notes: str | None = None
    terms: str | None = None
    shipping_address: str | None = None
    custom_issuer_info: str | None = None
    custom_recipient_info: str | None = None
    signature_url: str | None = None
    items: list[InvoiceItemCreate] | None = Field(default=None, min_length=1)


class InvoiceResponse(InvoiceBase):
    id: int
    invoice_number: str
    status: str
    company_id: int
    base_amount: float
    tax_amount: float
    total_amount: float
    is_rectification: bool
    original_invoice_id: int | None = None
    invoice_hash: str | None = None
    previous_invoice_hash: str | None = None
    issued_at: datetime | None = None
    paid_at: datetime | None = None
    issuer_snapshot: dict | None = None
    recipient_snapshot: dict | None = None
    rectification_reason: str | None = None
    rectification_reason_code: str | None = None
    fiscal_submission_status: str
    qr_url: str | None = None
    aeat_csv: str | None = None
    pdf_sha256: str | None = None
    pdf_generated_at: datetime | None = None
    facturae_sha256: str | None = None
    facturae_generated_at: datetime | None = None
    facturae_signed_at: datetime | None = None
    facturae_signature_status: str
    items: list[InvoiceItemResponse]
    created_at: datetime
    updated_at: datetime


    @field_validator("payment_method", mode="before")
    @classmethod
    def normalize_legacy_payment_method(cls, value: object) -> object:
        # Read compatibility only; stored fiscal records and write schemas stay unchanged.
        return "bank_transfer" if value == "transfer" else value


class InvoiceListResponse(InvoiceResponse):
    collected_amount: float


class RectificationCreate(BaseModel):
    """Schema to create a rectifying invoice (credit note).
    Complies with VAT Law Art. 80 and RD 1619/2012 (Spanish regulations).
    The reason for rectification is required by law.
    """
    reason: str
    reason_code: Literal[
        "01", "02", "03", "04", "05", "06", "07", "08", "09",
        "10", "11", "12", "13", "14", "15", "16",
        "80", "81", "82", "83", "84", "85",
    ] = "10"
    issue_date: datetime
    due_date: datetime | None = None
    notes: str | None = None

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("The rectification reason is required by Spanish regulations.")
        return v.strip()


class FiscalInvoiceRecordResponse(BaseModel):
    id: int
    invoice_id: int
    company_id: int
    record_type: str
    payload: dict
    previous_hash: str | None = None
    record_hash: str
    hash_algorithm: str
    submission_status: str
    aeat_csv: str | None = None
    error_message: str | None = None
    operation_reason: str | None = None
    attempt_count: int
    last_attempt_at: datetime | None = None
    next_retry_at: datetime | None = None
    generated_at: datetime
    submitted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceEmailRequest(BaseModel):
    recipient_email: EmailStr | None = None
    recipient_emails: list[EmailStr] | None = None
    copy_emails: list[EmailStr] | None = None
    subject: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=2000)
    send_copy: bool = False
    save_recipients: bool = False
    save_recipient_to_client_id: int | None = Field(default=None, gt=0)
    locale: Literal["es", "en"] = "es"


class FiscalCancellationRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)
    confirm_no_real_operation: bool

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return value.strip()


class FacturaeGenerateRequest(BaseModel):
    sign: bool = False
