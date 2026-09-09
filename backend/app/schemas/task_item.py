import json
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.schemas.reservation import ReservationOperationalResponse
from app.schemas.location_zone import TaskZoneResponse


MAX_REPORT_COLLECTION_ITEMS = 200
MAX_REPORT_PAYLOAD_BYTES = 256 * 1024
TaskStatus = Literal[
    "requested",
    "pending",
    "accepted",
    "progress",
    "review",
    "completed",
    "rejected",
]


def _validate_report_payload(value: Any) -> Any:
    if value is None:
        return value
    if isinstance(value, (list, dict)) and len(value) > MAX_REPORT_COLLECTION_ITEMS:
        raise ValueError("Task report collections cannot exceed 200 items")
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    if len(encoded) > MAX_REPORT_PAYLOAD_BYTES:
        raise ValueError("Task report data cannot exceed 256 KiB")
    return value


class TaskItemBase(BaseModel):
    title: str
    description: str | None = None
    notes: str | None = None
    operational_notes: list[dict[str, Any]] = Field(default_factory=list)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    checklist_evidence: dict[str, Any] = Field(default_factory=dict)
    reported_issues: list[dict[str, Any]] = Field(default_factory=list)
    price: float | None = None
    quantity: float | None = None
    unit: str
    pricing_mode: Literal["fixed", "hourly"] = "fixed"
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

    _limit_report_payload = field_validator(
        "operational_notes",
        "attachments",
        "checklist_evidence",
        "reported_issues",
    )(_validate_report_payload)


class TaskItemCreate(TaskItemBase):
    status: TaskStatus = "pending"
    created_at: datetime | None = None
    zone_ids: list[int] = Field(default_factory=list, max_length=100)
    space_ids: list[int] = Field(default_factory=list, max_length=100)
    space_task_template_ids: list[int] = Field(default_factory=list, max_length=200)


class TaskItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    operational_notes: list[dict[str, Any]] | None = None
    attachments: list[dict[str, Any]] | None = None
    checklist_evidence: dict[str, Any] | None = None
    reported_issues: list[dict[str, Any]] | None = None
    price: float | None = None
    quantity: float | None = None
    unit: str | None = None
    pricing_mode: Literal["fixed", "hourly"] | None = None
    status: TaskStatus | None = None
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
    zone_ids: list[int] | None = Field(default=None, max_length=100)
    space_ids: list[int] | None = Field(default=None, max_length=100)

    _limit_report_payload = field_validator(
        "operational_notes",
        "attachments",
        "checklist_evidence",
        "reported_issues",
    )(_validate_report_payload)


class TaskAcceptRequest(BaseModel):
    scheduled_start_at: datetime | None = None
    pricing_mode: Literal["fixed", "hourly"] | None = None
    price: float | None = None
    quantity: float | None = None
    unit: str | None = None


class TaskWorkStartRequest(BaseModel):
    notes: str | None = None
    start_latitude: float = Field(ge=-90, le=90)
    start_longitude: float = Field(ge=-180, le=180)
    start_accuracy_meters: float | None = Field(default=None, ge=0)


class TaskChecklistItemUpdate(BaseModel):
    completed: bool
    answer: Literal["yes", "no"] | None = None

    @model_validator(mode="after")
    def validate_answer_state(self):
        if not self.completed and self.answer is not None:
            raise ValueError("An unanswered checklist item cannot have an answer")
        return self


class TaskChecklistAssignmentResponse(BaseModel):
    user_id: int
    user_name: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class TaskChecklistItemResponse(BaseModel):
    id: int
    position: int
    text: str
    completed: bool
    space_name: str | None = None
    assignments: list[TaskChecklistAssignmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaskAssignmentResponse(TaskChecklistAssignmentResponse):
    source: str


class TaskItemResponse(TaskItemBase):
    id: int
    status: str
    date_done: datetime | None = None
    is_invoiced: bool
    worked_seconds_snapshot: int | None = None
    pricing_locked_at: datetime | None = None
    billing_pricing_mode_snapshot: Literal["fixed", "hourly"] | None = None
    billing_price_snapshot: float | None = None
    billing_quantity_snapshot: float | None = None
    billing_unit_snapshot: str | None = None
    service_catalog_version_id: int | None = None
    created_at: datetime
    updated_at: datetime
    checkout_reservation: ReservationOperationalResponse | None = None
    next_reservation: ReservationOperationalResponse | None = None
    user_company_id: int | None = None
    accepted_by_user_id: int | None = None
    accepted_by_name: str | None = None
    checklist_items: list[TaskChecklistItemResponse] = Field(default_factory=list)
    assignments: list[TaskAssignmentResponse] = Field(default_factory=list)
    zones: list[TaskZoneResponse] = Field(default_factory=list)
    spaces: list[TaskZoneResponse] = Field(default_factory=list)


class InvoiceableWorkerHours(BaseModel):
    user_id: int
    user_name: str
    worked_seconds: int
    worked_hours: float


class InvoiceableTaskResponse(TaskItemResponse):
    client_id: int
    client_name: str
    location_name: str
    billing_source: str = "own"
    collaborator_company_id: int | None = None
    collaborator_company_name: str | None = None
    worked_seconds: int = 0
    worked_hours: float = 0
    workers: list[InvoiceableWorkerHours] = Field(default_factory=list)
