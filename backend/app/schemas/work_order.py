from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


WorkOrderStatus = Literal["draft", "active", "paused", "completed", "cancelled"]
WorkOrderType = Literal["one_off", "recurring"]
RecurrenceUnit = Literal["weekly", "monthly"]


def normalize_work_order_date(value: datetime | None) -> datetime | None:
    """Treat zone-less order dates as UTC and preserve offset-aware instants."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _validate_recurrence(
    order_type: WorkOrderType,
    recurrence_unit: RecurrenceUnit | None,
    recurrence_interval: int | None,
    scheduled_start_at: datetime,
    recurrence_ends_at: datetime | None,
) -> None:
    if recurrence_ends_at is not None and (
        normalize_work_order_date(recurrence_ends_at) < normalize_work_order_date(scheduled_start_at)
    ):
        raise ValueError("La recurrencia no puede terminar antes del primer servicio")
    if order_type == "recurring":
        if recurrence_unit is None or recurrence_interval is None:
            raise ValueError("Una orden recurrente necesita frecuencia e intervalo")
        return
    if recurrence_unit is not None or recurrence_interval is not None or recurrence_ends_at is not None:
        raise ValueError("Una orden individual no admite configuración recurrente")


class WorkOrderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    location_id: int
    service_contract_id: int | None = None
    description: str | None = Field(default=None, max_length=10_000)
    status: WorkOrderStatus = "draft"
    order_type: WorkOrderType = "one_off"
    scheduled_start_at: datetime
    recurrence_unit: RecurrenceUnit | None = None
    recurrence_interval: int | None = Field(default=None, ge=1, le=52)
    recurrence_ends_at: datetime | None = None
    estimated_people: int | None = Field(default=None, ge=1, le=1_000)
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)

    _normalize_dates = field_validator("scheduled_start_at", "recurrence_ends_at")(
        normalize_work_order_date
    )

    @model_validator(mode="after")
    def validate_recurrence(self):
        _validate_recurrence(
            self.order_type,
            self.recurrence_unit,
            self.recurrence_interval,
            self.scheduled_start_at,
            self.recurrence_ends_at,
        )
        return self


class WorkOrderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    status: WorkOrderStatus | None = None
    scheduled_start_at: datetime | None = None
    next_occurrence_at: datetime | None = None
    recurrence_unit: RecurrenceUnit | None = None
    recurrence_interval: int | None = Field(default=None, ge=1, le=52)
    recurrence_ends_at: datetime | None = None
    estimated_people: int | None = Field(default=None, ge=1, le=1_000)
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)

    _normalize_dates = field_validator(
        "scheduled_start_at", "next_occurrence_at", "recurrence_ends_at"
    )(normalize_work_order_date)


class WorkOrderResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: WorkOrderStatus
    order_type: WorkOrderType
    location_id: int
    service_contract_id: int | None
    scheduled_start_at: datetime
    next_occurrence_at: datetime | None
    recurrence_unit: RecurrenceUnit | None
    recurrence_interval: int | None
    recurrence_ends_at: datetime | None
    estimated_people: int | None
    estimated_minutes: int | None
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class WorkOrderOccurrenceResponse(BaseModel):
    work_order: WorkOrderResponse
    task_item_id: int


class WorkOrderContractCandidate(BaseModel):
    contract_id: int
    contract_title: str
    location_id: int
    location_name: str
