"""Operational scope editing never exposes employee pay or customer prices."""
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from app.schemas.location_workspace import LocationSpaceResponse
from app.schemas.workforce_plan import SpaceAllocation


class TaskSpaceScopeInput(BaseModel):
    spaces: list[SpaceAllocation] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def bounded_tasks(self):
        if sum(len(space.task_ids) for space in self.spaces) > 200:
            raise ValueError("Cada ejecución admite hasta 200 tareas de espacios. Divide el servicio en varios trabajos.")
        return self


class ScopePerson(BaseModel):
    id: int
    name: str
    position: str
    state: str


class ScopeCrew(BaseModel):
    id: int
    name: str
    employee_ids: list[int]


class ScopeChoices(BaseModel):
    people: list[ScopePerson]
    crews: list[ScopeCrew]


class TaskSpaceScopeResponse(BaseModel):
    task_id: int
    location_id: int
    scheduled_start_at: datetime | None
    spaces: list[SpaceAllocation]
    available_spaces: list[LocationSpaceResponse]
    choices: ScopeChoices
    can_edit: bool
    blocked_reason: str | None
