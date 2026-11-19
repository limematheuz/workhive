from decimal import Decimal
from pydantic import BaseModel,Field,ConfigDict,model_validator
from app.schemas.workforce_plan import SpaceAllocation


class EstimateMaterial(BaseModel):
    material_id:int=Field(ge=1)
    warehouse_id:int=Field(ge=1)
    quantity:Decimal=Field(gt=0,max_digits=14,decimal_places=3)


class EstimateInput(BaseModel):
    model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
    location_id:int=Field(ge=1)
    spaces:list[SpaceAllocation]=Field(min_length=1,max_length=100)
    materials:list[EstimateMaterial]=Field(default_factory=list,max_length=100)
    other_costs:Decimal=Field(default=Decimal("0"),ge=0,max_digits=12,decimal_places=2)
    target_margin_percent:Decimal=Field(default=Decimal("25"),ge=0,le=95,decimal_places=2)
    occurrences:int=Field(default=1,ge=1,le=366)
    tax_rate:Decimal=Field(default=Decimal("0.21"),ge=0,le=1,decimal_places=4)

    @model_validator(mode="after")
    def unique_sources(self):
        ids=[row.space_id for row in self.spaces]
        if len(set(ids))!=len(ids):raise ValueError("Cada espacio debe aparecer una sola vez.")
        keys=[(row.material_id,row.warehouse_id) for row in self.materials]
        if len(set(keys))!=len(keys):raise ValueError("Combina la cantidad de cada material y almacén en una sola línea.")
        return self


class EstimateQuoteInput(EstimateInput):
    title:str=Field(min_length=1,max_length=255)
    opportunity_id:int|None=Field(default=None,ge=1)
    expected_fingerprint:str=Field(min_length=64,max_length=64)
