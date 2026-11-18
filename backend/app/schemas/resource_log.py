from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel,Field,model_validator
from typing import Literal


class VehicleInput(BaseModel):
    name:str = Field(min_length=1,max_length=140)
    registration:str = Field(min_length=1,max_length=30)
    odometer:Decimal = Field(ge=0,max_digits=12,decimal_places=1)
    service_due_on:date|None = None
    status:Literal["active","maintenance","retired"] = "active"


class JourneyInput(BaseModel):
    vehicle_id:int
    employee_id:int
    location_id:int
    starts_at:datetime
    ends_at:datetime
    start_km:Decimal = Field(ge=0,max_digits=12,decimal_places=1)
    end_km:Decimal = Field(ge=0,max_digits=12,decimal_places=1)
    notes:str = Field(default="",max_length=2000)

    @model_validator(mode="after")
    def valid_trip(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Indica la zona horaria del trayecto.")
        if self.ends_at<=self.starts_at or self.end_km<self.start_km:
            raise ValueError("Revisa los horarios y el kilometraje.")
        return self


class CustodyInput(BaseModel):
    equipment_id:int
    employee_id:int
    notes:str = Field(default="",max_length=2000)
