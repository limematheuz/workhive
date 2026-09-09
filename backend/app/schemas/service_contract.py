from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ServiceContractTermsUpdate(BaseModel):
    """Commercial operating terms added after the accepted quote is frozen."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    renewal_mode: Literal["manual", "automatic"] | None = None
    renewal_notice_days: int | None = Field(default=None, ge=0, le=365)
    response_time_hours: int | None = Field(default=None, ge=0, le=720)
    resolution_time_hours: int | None = Field(default=None, ge=0, le=720)
    service_window: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=5000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("title")
    @classmethod
    def require_non_blank_title(cls, value: str | None) -> str | None:
        if value is not None and not value:
            raise ValueError("Title cannot be blank")
        return value


class ServiceContractLocationsUpdate(BaseModel):
    location_ids: list[int] = Field(min_length=1, max_length=200)

    model_config = ConfigDict(extra="forbid")


class ServiceContractLocationZonesUpdate(BaseModel):
    zone_ids: list[int] = Field(default_factory=list, max_length=500)

    model_config = ConfigDict(extra="forbid")


class ServiceContractLineResponse(BaseModel):
    id: int
    position: int
    description: str
    quantity: float
    unit_price: float
    subtotal: float

    model_config = ConfigDict(from_attributes=True)


class ServiceContractLocationResponse(BaseModel):
    id: int
    location_id: int
    location_name: str | None
    is_active: bool
    covered_from: datetime
    covered_until: datetime | None
    covered_zones: list["ServiceContractLocationZoneResponse"] = Field(
        default_factory=list
    )

    model_config = ConfigDict(from_attributes=True)


class ServiceContractLocationZoneResponse(BaseModel):
    id: int
    zone_id: int
    zone_name: str | None

    model_config = ConfigDict(from_attributes=True)


class ServiceContractResponse(BaseModel):
    id: int
    contract_number: str
    title: str
    status: str
    company_id: int
    client_id: int | None
    source_quote_id: int
    source_quote_revision_id: int
    starts_at: datetime | None
    ends_at: datetime | None
    renewal_mode: str
    renewal_notice_days: int
    response_time_hours: int | None
    resolution_time_hours: int | None
    service_window: str | None
    notes: str | None
    quote_snapshot: dict[str, Any]
    service_lines: list[ServiceContractLineResponse]
    covered_locations: list[ServiceContractLocationResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
