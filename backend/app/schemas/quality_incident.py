from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


IncidentSeverity = Literal["low", "medium", "high", "critical"]
IncidentStatus = Literal["open", "in_progress", "resolved", "closed"]
CorrectiveActionStatus = Literal["pending", "completed", "cancelled"]


class QualityIncidentCreate(BaseModel):
    location_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5_000)
    severity: IncidentSeverity = "medium"
    inspection_id: int | None = Field(default=None, gt=0)
    inspection_item_id: int | None = Field(default=None, gt=0)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El título no puede estar vacío")
        return normalized


class QualityIncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5_000)
    severity: IncidentSeverity | None = None
    status: IncidentStatus | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("El título no puede estar vacío")
        return normalized


class QualityCorrectiveActionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5_000)
    due_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("La acción no puede estar vacía")
        return normalized


class QualityCorrectiveActionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5_000)
    due_at: datetime | None = None
    status: CorrectiveActionStatus | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("La acción no puede estar vacía")
        return normalized


class QualityCorrectiveActionResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: CorrectiveActionStatus
    due_at: datetime | None
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class QualityIncidentResponse(BaseModel):
    id: int
    location_id: int
    inspection_id: int | None
    inspection_item_id: int | None
    title: str
    description: str | None
    severity: IncidentSeverity
    status: IncidentStatus
    created_at: datetime
    resolved_at: datetime | None
    corrective_actions: list[QualityCorrectiveActionResponse]

    model_config = ConfigDict(from_attributes=True)
