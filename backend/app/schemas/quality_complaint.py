from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ComplaintCategory = Literal["service", "billing", "damage", "other"]
ComplaintStatus = Literal["submitted", "in_review", "resolved", "closed"]
ComplaintSource = Literal["client_portal", "internal"]


class _ComplaintText(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5_000)

    @field_validator("title", "description")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Este campo no puede estar vacío")
        return normalized


class QualityComplaintCreate(_ComplaintText):
    location_id: int = Field(gt=0)
    category: ComplaintCategory = "service"


class QualityComplaintUpdate(BaseModel):
    status: ComplaintStatus | None = None
    internal_notes: str | None = Field(default=None, max_length=5_000)
    customer_response: str | None = Field(default=None, max_length=5_000)

    model_config = ConfigDict(extra="forbid")

    @field_validator("internal_notes", "customer_response")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class QualityComplaintResponse(BaseModel):
    id: int
    client_id: int
    location_id: int
    title: str
    description: str
    category: ComplaintCategory
    status: ComplaintStatus
    source: ComplaintSource
    internal_notes: str | None
    customer_response: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
