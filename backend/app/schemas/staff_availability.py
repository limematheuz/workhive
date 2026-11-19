from datetime import datetime, timezone, timedelta
from typing import Literal
from pydantic import BaseModel, Field, model_validator

QualificationCode = Literal["general_cleaning", "chemical_handling", "height_work", "industrial_cleaning", "food_hygiene"]


class WeeklyAvailability(BaseModel):
    weekday: int = Field(ge=0, le=6)
    starts_at: str = Field(pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
    ends_at: str = Field(pattern=r"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$")

    @model_validator(mode="after")
    def ordered(self):
        if self.starts_at >= self.ends_at:
            raise ValueError("El final debe ser posterior al inicio. Divide los turnos nocturnos por días.")
        return self


class SubstituteSearch(BaseModel):
    location_id: int = Field(ge=1)
    starts_at: datetime
    ends_at: datetime
    required_training_codes: list[QualificationCode] = Field(default_factory=list, max_length=5)
    absence_id: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0, le=100000)

    @model_validator(mode="after")
    def valid_period(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Indica la zona horaria del periodo.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        if not timedelta(minutes=1) <= self.ends_at - self.starts_at <= timedelta(hours=24):
            raise ValueError("Busca un periodo entre 1 minuto y 24 horas.")
        if len(set(self.required_training_codes)) != len(self.required_training_codes):
            raise ValueError("No repitas requisitos de formación.")
        return self


class SubstituteAssignment(SubstituteSearch):
    absence_id: int = Field(ge=1)
    employee_id: int = Field(ge=1)
