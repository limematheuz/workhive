"""Stable, minimal public response contracts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.datetime import as_utc
from app.schemas.reservation import ReservationStayType


class PublicWorkOrderResponse(BaseModel):
    id: int
    title: str
    status: Literal["draft", "active", "paused", "completed", "cancelled"]
    order_type: Literal["one_off", "recurring"]
    location_id: int
    scheduled_start_at: datetime
    next_occurrence_at: datetime | None
    recurrence_unit: Literal["weekly", "monthly"] | None
    recurrence_interval: int | None
    recurrence_ends_at: datetime | None
    estimated_people: int | None
    estimated_minutes: int | None
    updated_at: datetime | None


class PublicReservationUpsert(BaseModel):
    location_id: int
    check_in_at: datetime
    check_out_at: datetime
    guest_count: int = Field(default=1, ge=1, le=10_000)
    stay_type: ReservationStayType = "guest"
    status: Literal["confirmed", "cancelled"] = "confirmed"
    notes: str | None = Field(default=None, max_length=5_000)
    cleaning_required: bool = True
    cleaning_scheduled_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    _normalize_dates = field_validator("check_in_at", "check_out_at", "cleaning_scheduled_at")(as_utc)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.check_out_at <= self.check_in_at:
            raise ValueError("Check-out must be after check-in")
        return self


class PublicReservationResponse(BaseModel):
    id: int
    location_id: int
    check_in_at: datetime
    check_out_at: datetime
    guest_count: int
    stay_type: str
    status: Literal["confirmed", "cancelled"]
    source: str
    external_reference: str
    cleaning_required: bool
    cleaning_scheduled_at: datetime | None
    updated_at: datetime | None
