from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel,Field,model_validator


class RequestInput(BaseModel):
    employee_id:int
    kind:Literal["vacation","material","shift","advance","purchase","extra_hours"]
    description:str=Field(min_length=1,max_length=2000)
    starts_on:date
    ends_on:date
    amount:Decimal=Field(default=Decimal("0"),ge=0,max_digits=12,decimal_places=2)

    @model_validator(mode="after")
    def valid_period(self):
        if not 0<=(self.ends_on-self.starts_on).days<366:
            raise ValueError("Revisa las fechas de la solicitud.")
        return self


class RequestReview(BaseModel):
    decision:Literal["approved","rejected"]
