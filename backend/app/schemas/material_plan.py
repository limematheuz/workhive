from decimal import Decimal
from pydantic import BaseModel,Field


class MaterialPlanInput(BaseModel):
    material_id:int=Field(ge=1)
    quantity:Decimal=Field(ge=0,max_digits=14,decimal_places=3)
