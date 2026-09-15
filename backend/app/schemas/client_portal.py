"""Public contracts for the deliberately narrow customer portal."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.user import validate_user_password


class ClientPortalInvitationCreate(BaseModel):
    email: EmailStr

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ClientPortalInvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    verification_code: str = Field(min_length=8, max_length=16)
    full_name: str = Field(min_length=1, max_length=100)
    password: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    marketing_consent: bool = False

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value: str | None) -> str | None:
        return validate_user_password(value) if value is not None else None

    @model_validator(mode="after")
    def validate_legal_acknowledgements(self) -> "ClientPortalInvitationAccept":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("Terms and privacy notice must be explicitly accepted")
        return self


class ClientPortalInvitationResponse(BaseModel):
    id: int
    email: EmailStr
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientPortalGrantResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    status: str
    expires_at: datetime | None
    created_at: datetime


class ClientPortalInvitationAccepted(BaseModel):
    status: str = "accepted"


class ClientPortalWorkspaceResponse(BaseModel):
    id: int
    company_name: str
    client_name: str
    status: str
    expires_at: datetime | None = None


class ClientPortalLineResponse(BaseModel):
    description: str
    quantity: float
    unit_price: float
    subtotal: float
    tax_rate: float | None = None
    total: float | None = None


class ClientPortalInvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    issue_date: datetime
    due_date: datetime | None
    status: str
    base_amount: float
    tax_amount: float
    total_amount: float
    is_rectification: bool
    original_invoice_id: int | None
    payment_method: str | None
    paid_at: datetime | None
    lines: list[ClientPortalLineResponse]


class ClientPortalQuoteResponse(BaseModel):
    id: int
    quote_number: str
    title: str
    status: str
    valid_until: datetime | None
    base_amount: float
    tax_amount: float
    total_amount: float
    terms: str | None
    revision_number: int
    lines: list[ClientPortalLineResponse]


class ClientPortalContractLocationResponse(BaseModel):
    location_name: str | None
    covered_from: datetime
    covered_until: datetime | None
    zone_names: list[str]


class ClientPortalContractResponse(BaseModel):
    id: int
    contract_number: str
    title: str
    status: str
    starts_at: datetime | None
    ends_at: datetime | None
    renewal_mode: str
    renewal_notice_days: int
    response_time_hours: int | None
    resolution_time_hours: int | None
    service_window: str | None
    lines: list[ClientPortalLineResponse]
    covered_locations: list[ClientPortalContractLocationResponse]


class ClientPortalInspectionItemResponse(BaseModel):
    title: str
    status: str
    points_awarded: int
    max_points: int


class ClientPortalInspectionAcceptanceCreate(BaseModel):
    confirmed: bool
    signer_name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ClientPortalInspectionAcceptanceResponse(BaseModel):
    signer_name: str
    statement_version: str
    signed_at: datetime


class ClientPortalInspectionResponse(BaseModel):
    id: int
    template_title: str
    location_name: str
    completed_at: datetime
    score: int
    max_score: int
    items: list[ClientPortalInspectionItemResponse]
    acceptance: ClientPortalInspectionAcceptanceResponse | None


class ClientPortalComplaintLocationResponse(BaseModel):
    id: int
    name: str


class ClientPortalComplaintCreate(BaseModel):
    location_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5_000)
    category: Literal["service", "billing", "damage", "other"] = "service"

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("title", "description")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        if not value:
            raise ValueError("Este campo no puede estar vacío")
        return value


class ClientPortalComplaintResponse(BaseModel):
    id: int
    location_id: int
    location_name: str
    title: str
    description: str
    category: Literal["service", "billing", "damage", "other"]
    status: Literal["submitted", "in_review", "resolved", "closed"]
    customer_response: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class ClientPortalOverviewResponse(BaseModel):
    workspace: ClientPortalWorkspaceResponse
    invoices: list[ClientPortalInvoiceResponse]
    quotes: list[ClientPortalQuoteResponse]
    contracts: list[ClientPortalContractResponse]
    inspections: list[ClientPortalInspectionResponse]
    complaint_locations: list[ClientPortalComplaintLocationResponse]
    complaints: list[ClientPortalComplaintResponse]
