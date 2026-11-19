from datetime import datetime, timezone, timedelta
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class OfflineInput(BaseModel):
    expected_user_id: int | None = Field(default=None, gt=0)
    expected_company_id: int | None = Field(default=None, gt=0)
    event_id: UUID
    task_id: int
    starts_at: datetime
    ends_at: datetime
    paused_seconds: int = Field(default=0,ge=0)
    checklist_ids: list[int] = Field(default_factory=list,max_length=200)
    description: str = Field(min_length=1,max_length=10000)

    @model_validator(mode="after")
    def validate_period(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Los fichajes necesitan zona horaria.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        if not timedelta(0) < self.ends_at-self.starts_at <= timedelta(hours=24):
            raise ValueError("El parte debe cubrir un máximo de 24 horas.")
        if self.ends_at > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("La salida no puede estar en el futuro.")
        if self.paused_seconds >= (self.ends_at-self.starts_at).total_seconds():
            raise ValueError("Las pausas deben durar menos que la jornada.")
        return self


class OfflineReview(BaseModel):
    decision: Literal["approved","rejected"]
