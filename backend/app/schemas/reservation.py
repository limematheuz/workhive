from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.core.datetime import as_utc
from app.schemas.work_session import WorkSessionStartLocationResponse


ReservationStatus = Literal["confirmed", "tentative", "cancelled"]
ReservationStayType = Literal["guest", "owner", "block"]


class ReservationBase(BaseModel):
    location_id: int
    check_in_at: datetime
    check_out_at: datetime
    guest_count: int = Field(default=1, ge=1)
    stay_type: str = "guest"
    status: str = "confirmed"
    source: str = "manual"
    external_reference: str | None = None
    notes: str | None = None
    cleaning_required: bool = True

    model_config = ConfigDict(from_attributes=True)

    _normalize_dates = field_validator("check_in_at", "check_out_at")(as_utc)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.check_out_at <= self.check_in_at:
            raise ValueError("La fecha de salida (check-out) debe ser posterior a la fecha de entrada (check-in).")
        return self


class ReservationCreate(ReservationBase):
    stay_type: ReservationStayType = "guest"
    status: ReservationStatus = "confirmed"
    assigned_company_id: int | None = None
    cleaning_scheduled_at: datetime | None = None

    _normalize_cleaning = field_validator("cleaning_scheduled_at")(as_utc)


class ReservationUpdate(BaseModel):
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    guest_count: int | None = Field(default=None, ge=1)
    stay_type: ReservationStayType | None = None
    status: ReservationStatus | None = None
    source: str | None = None
    external_reference: str | None = None
    notes: str | None = None
    cleaning_required: bool | None = None
    assigned_company_id: int | None = None
    cleaning_scheduled_at: datetime | None = None

    _normalize_dates = field_validator("check_in_at", "check_out_at", "cleaning_scheduled_at")(as_utc)

    @field_validator(
        "check_in_at", "check_out_at", "guest_count", "stay_type",
        "status", "source", "cleaning_required",
    )
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("Value cannot be null")
        return value


class ReservationOperationalResponse(BaseModel):
    id: int
    location_id: int
    owner_company_id: int
    owner_company_name: str | None = None
    created_by_user_id: int | None = None
    created_by_user_name: str | None = None
    check_in_at: datetime
    check_out_at: datetime
    guest_count: int
    stay_type: str
    status: str
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ReservationResponse(ReservationBase):
    id: int
    owner_company_id: int
    created_by_user_id: int | None = None
    updated_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime
    assigned_company_id: int | None = None
    assigned_company_name: str | None = None
    cleaning_status: str | None = None
    cleaning_scheduled_at: datetime | None = None
    service_request_sent_at: datetime | None = None
    cleaning_start_locations: list[WorkSessionStartLocationResponse] = Field(
        default_factory=list
    )
