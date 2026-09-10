from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkSessionCorrectionCreate(BaseModel):
    requested_start_time: datetime
    requested_end_time: datetime
    reason: str = Field(min_length=5, max_length=1000)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.requested_end_time <= self.requested_start_time:
            raise ValueError("La salida propuesta debe ser posterior a la entrada")
        return self


class WorkSessionCorrectionReview(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=1000)


class WorkSessionCorrectionResponse(BaseModel):
    id: int
    company_id: int
    work_session_id: int
    requested_by_user_id: int | None
    original_start_time: datetime
    original_end_time: datetime
    requested_start_time: datetime
    requested_end_time: datetime
    reason: str
    status: Literal["pending", "approved", "rejected"]
    reviewed_by_user_id: int | None
    reviewed_at: datetime | None
    review_note: str | None
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
