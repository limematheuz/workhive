from typing import Literal
from pydantic import BaseModel,Field,ConfigDict,model_validator
from app.schemas.work_order import WorkOrderCreate


class CrewInput(BaseModel):
    name:str=Field(min_length=1,max_length=120)
    description:str=Field(default="",max_length=2000)
    leader_employee_id:int|None=Field(default=None,ge=1)
    employee_ids:list[int]=Field(default_factory=list,max_length=500)
    is_active:bool=True

    @model_validator(mode="after")
    def valid_members(self):
        if len(set(self.employee_ids))!=len(self.employee_ids) or any(id<1 for id in self.employee_ids):raise ValueError("Revisa los miembros del equipo.")
        if self.leader_employee_id is not None and self.leader_employee_id not in self.employee_ids:raise ValueError("El responsable debe formar parte del equipo.")
        return self


class SpaceAllocation(BaseModel):
    space_id:int=Field(ge=1)
    task_ids:list[int]=Field(default_factory=list,max_length=200)
    employee_ids:list[int]=Field(default_factory=list,max_length=100)
    crew_id:int|None=Field(default=None,ge=1)
    planned_minutes:int|None=Field(default=None,ge=1,le=100000)

    @model_validator(mode="after")
    def valid_selection(self):
        for values in (self.task_ids,self.employee_ids):
            if len(set(values))!=len(values) or any(id<1 for id in values):raise ValueError("Selecciona identificadores únicos y válidos.")
        if self.crew_id is not None and self.employee_ids:raise ValueError("Elige trabajadores o un equipo para cada espacio.")
        return self


class ServicePlanInput(BaseModel):
    work_order:WorkOrderCreate
    spaces:list[SpaceAllocation]=Field(min_length=1,max_length=100)
    generate_first:bool=True
    execution_count:int|None=Field(default=None,ge=1,le=1000)

    @model_validator(mode="after")
    def unique_spaces(self):
        ids=[space.space_id for space in self.spaces]
        if len(set(ids))!=len(ids):raise ValueError("Cada espacio debe aparecer una sola vez.")
        if sum(len(space.task_ids) for space in self.spaces)>200:raise ValueError("Cada ejecución admite hasta 200 tareas de espacios. Divide el servicio en varios trabajos.")
        if self.generate_first and self.work_order.status!="active":raise ValueError("Activa la orden para generar su ejecución.")
        return self


class ProgressInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    completed:bool
    answer:Literal["yes","no"]|None=None
