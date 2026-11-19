from datetime import datetime,timezone
from decimal import Decimal
from pydantic import BaseModel,ConfigDict,Field,model_validator

class QuickWorkInput(BaseModel):
    model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
    title:str=Field(min_length=1,max_length=150)
    location_id:int|None=Field(default=None,ge=1)
    client_id:int|None=Field(default=None,ge=1)
    address:str|None=Field(default=None,max_length=255)
    city:str|None=Field(default=None,max_length=100)
    postal_code:str|None=Field(default=None,max_length=20)
    save_location:bool=False
    service_id:int|None=Field(default=None,ge=1)
    scheduled_start_at:datetime
    duration_minutes:int=Field(ge=1,le=1440)
    employee_ids:list[int]=Field(default_factory=list,max_length=100)
    crew_id:int|None=Field(default=None,ge=1)
    tasks:list[str]|None=Field(default=None,max_length=200)
    instructions:str=Field(default="",max_length=2000)
    price:Decimal|None=Field(default=None,ge=0,max_digits=14,decimal_places=2)
    @model_validator(mode="after")
    def valid_scope(self):
        if self.scheduled_start_at.utcoffset() is None:raise ValueError("Indica la zona horaria del inicio.")
        self.scheduled_start_at=self.scheduled_start_at.astimezone(timezone.utc)
        if self.location_id is None and (not self.address or not self.city):raise ValueError("Indica dirección y población para el trabajo puntual.")
        if self.location_id is not None and (self.address or self.city or self.save_location):raise ValueError("Elige un centro existente o una dirección puntual.")
        if self.crew_id and self.employee_ids:raise ValueError("Selecciona trabajadores o un equipo.")
        if len(set(self.employee_ids))!=len(self.employee_ids) or any(id<1 for id in self.employee_ids):raise ValueError("Selecciona trabajadores únicos y válidos.")
        if self.tasks is not None:
            self.tasks=[text.strip() for text in self.tasks]
            if any(not text or len(text)>160 or "\n" in text or "\r" in text for text in self.tasks):raise ValueError("Cada tarea debe ocupar una línea de entre 1 y 160 caracteres.")
        return self
