"""Stable, minimal public response contracts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


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
