from datetime import datetime
from typing import Literal

from pydantic import BaseModel


LocationHistoryPeriod = Literal["day", "week", "month"]


class LocationHistoryTaskResponse(BaseModel):
    id: int
    title: str
    status: str
    completed_at: datetime
    scheduled_start_at: datetime | None = None


class LocationHistorySessionResponse(BaseModel):
    id: int
    task_item_id: int | None = None
    task_title: str | None = None
    user_id: int
    user_name: str
    started_at: datetime
    ended_at: datetime
    worked_seconds: int


class LocationOperationalHistoryResponse(BaseModel):
    location_id: int
    period: LocationHistoryPeriod
    period_start: datetime
    period_end: datetime
    completed_tasks: list[LocationHistoryTaskResponse]
    sessions: list[LocationHistorySessionResponse]
    completed_task_count: int
    completed_task_total: int
    session_total: int
    worked_seconds: int
