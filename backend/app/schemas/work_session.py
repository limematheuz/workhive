from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class WorkSessionBase(BaseModel):
    notes: str | None = None
    location_id: int
    task_item_id: int | None = None
    start_latitude: float | None = Field(default=None, ge=-90, le=90)
    start_longitude: float | None = Field(default=None, ge=-180, le=180)
    start_accuracy_meters: float | None = Field(default=None, ge=0)

    model_config = ConfigDict(from_attributes=True)


class WorkSessionCreate(WorkSessionBase):
    task_item_id: int
    start_latitude: float = Field(ge=-90, le=90)
    start_longitude: float = Field(ge=-180, le=180)


class WorkSessionUpdate(BaseModel):
    notes: str | None = None


class WorkSessionResponse(WorkSessionBase):
    id: int
    user_id: int
    start_time: datetime
    end_time: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TaskWorkSummaryResponse(BaseModel):
    task_item_id: int
    total_seconds: int
    active_workers: int
    session_count: int


class ActiveCompanySessionResponse(WorkSessionResponse):
    user_name: str
    user_email: str
    worker_company_id: int
    worker_company_name: str
    visibility_scope: str
    location_name: str
    task_title: str | None = None
    elapsed_seconds: int


class WorkerTimeSummary(BaseModel):
    user_id: int
    user_name: str
    total_seconds: int
    is_active: bool


class WorkSessionStartLocationResponse(BaseModel):
    session_id: int
    user_id: int
    user_name: str
    started_at: datetime
    latitude: float
    longitude: float
    accuracy_meters: float | None = None


class TaskWorkDetailedSummaryResponse(BaseModel):
    task_item_id: int
    total_seconds: int
    active_workers: int
    session_count: int
    workers: list[WorkerTimeSummary]
    start_locations: list[WorkSessionStartLocationResponse]


class TaskWorkDetailedSummariesResponse(BaseModel):
    summaries: list[TaskWorkDetailedSummaryResponse]
