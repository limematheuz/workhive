from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, model_validator

class AbsenceInput(BaseModel):
    employee_id: int
    substitute_id: int | None = None
    starts_on: date
    ends_on: date
    kind: Literal["Vacaciones", "Permiso", "Ausencia"]

    @model_validator(mode="after")
    def validate_period(self):
        if not 0 <= (self.ends_on - self.starts_on).days < 366:
            raise ValueError("El periodo debe durar entre 1 y 366 días.")
        if self.employee_id == self.substitute_id:
            raise ValueError("Selecciona otra persona para la sustitución.")
        return self


class Absence(AbsenceInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
