from datetime import date
from typing import Literal
from pydantic import BaseModel,Field,model_validator


COLUMNS={
    "work":{"id","title","location","status","scheduled","completed","checklist_done","checklist_total"},
    "staff":{"id","name","position","team","status","monthly_hours","hourly_cost"},
    "quality":{"id","title","location","status","severity","created","resolved"},
}


class ReportInput(BaseModel):
    name:str=Field(min_length=1,max_length=120)
    kind:Literal["work","staff","quality"]
    columns:list[str]=Field(min_length=1,max_length=8)
    starts_on:date
    ends_on:date
    location_id:int|None=Field(default=None,ge=1)

    @model_validator(mode="after")
    def valid_configuration(self):
        if not set(self.columns)<=COLUMNS[self.kind] or len(set(self.columns))!=len(self.columns):
            raise ValueError("Selecciona columnas válidas sin duplicados.")
        if not 0<=(self.ends_on-self.starts_on).days<=3660:raise ValueError("Revisa el periodo del informe.")
        if self.kind=="staff" and self.location_id is not None:raise ValueError("La plantilla se consulta por empresa.")
        return self
