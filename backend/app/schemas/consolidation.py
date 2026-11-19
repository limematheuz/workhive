from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel,Field


class ConsolidationInput(BaseModel):
    companies:list[int] = Field(min_length=1,max_length=100)
    reference_date:date
    period:Literal["month","year"] = "month"
    currency:str = Field(default="EUR",pattern="^[A-Z]{3}$")
    eur_rate:Decimal = Field(default=Decimal("1"),gt=0,max_digits=18,decimal_places=8)


class CompanySettingsInput(BaseModel):
    parent_company_id:int|None=Field(default=None,ge=1)
    country:str = Field(pattern="^[A-Z]{2}$")
    timezone:str = Field(min_length=1,max_length=80)
    language:Literal["es","en"]
