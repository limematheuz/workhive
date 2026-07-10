from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.reservation import ReservationOperationalResponse


class TaskItemBase(BaseModel):
    title: str
    description: str | None = None
    notes: str | None = None
    operational_notes: list[dict[str, Any]] = Field(default_factory=list)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    checklist_evidence: dict[str, Any] = Field(default_factory=dict)
    price: float | None = None
    quantity: float | None = None
    unit: str
    template_task_id: int | None = None
    location_id: int
    user_id: int | None = None
    priority: str = "medium"
    scheduled_start_at: datetime | None = None
    due_at: datetime | None = None
    service_context: str = "standalone"
    checkout_reservation_id: int | None = None
    next_reservation_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskItemCreate(TaskItemBase):
    status: str = "pending"
    created_at: datetime | None = None


class TaskItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    operational_notes: list[dict[str, Any]] | None = None
    attachments: list[dict[str, Any]] | None = None
    checklist_evidence: dict[str, Any] | None = None
    price: float | None = None
    quantity: float | None = None
    unit: str | None = None
    status: str | None = None
    date_done: datetime | None = None
    template_task_id: int | None = None
    location_id: int | None = None
    user_id: int | None = None
    priority: str | None = None
    created_at: datetime | None = None
    scheduled_start_at: datetime | None = None
    due_at: datetime | None = None
    service_context: str | None = None
    checkout_reservation_id: int | None = None
    next_reservation_id: int | None = None


class TaskAcceptRequest(BaseModel):
    scheduled_start_at: datetime | None = None


class TaskWorkStartRequest(BaseModel):
    notes: str | None = None
    start_latitude: float = Field(ge=-90, le=90)
    start_longitude: float = Field(ge=-180, le=180)
    start_accuracy_meters: float | None = Field(default=None, ge=0)


class TaskItemResponse(TaskItemBase):
    id: int
    status: str
    date_done: datetime | None = None
    is_invoiced: bool
    created_at: datetime
    updated_at: datetime
    checkout_reservation: ReservationOperationalResponse | None = None
    next_reservation: ReservationOperationalResponse | None = None
    user_company_id: int | None = None
    accepted_by_user_id: int | None = None
    accepted_by_name: str | None = None


class InvoiceableTaskResponse(TaskItemResponse):
    client_id: int
    client_name: str
    location_name: str
    billing_source: str = "own"
    collaborator_company_id: int | None = None
    collaborator_company_name: str | None = None
    worked_seconds: int = 0
    worked_hours: float = 0
