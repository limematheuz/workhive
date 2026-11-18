from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, model_validator


class ShiftInput(BaseModel):
    employee_id: int
    location_id: int
    task_id: int | None = None
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_period(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Indica la zona horaria del turno.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        if not timedelta(minutes=1) <= self.ends_at - self.starts_at <= timedelta(hours=24):
            raise ValueError("El turno debe durar entre 1 minuto y 24 horas.")
        return self
