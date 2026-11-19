from decimal import Decimal
from pydantic import BaseModel,Field


class QuoteCostInput(BaseModel):
    revision:int=Field(ge=1)
    labor_hours:Decimal=Field(ge=0,le=100000,decimal_places=2)
    hourly_cost:Decimal=Field(ge=0,le=100000,decimal_places=2)
    materials:Decimal=Field(ge=0,max_digits=12,decimal_places=2)
    other_costs:Decimal=Field(ge=0,max_digits=12,decimal_places=2)
