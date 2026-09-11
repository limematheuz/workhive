from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LaborCostRateCreate(BaseModel):
    company_membership_id: int = Field(gt=0)
    hourly_cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    effective_on: date


class LaborCostRateResponse(BaseModel):
    id: int
    company_membership_id: int
    member_name: str | None = None
    hourly_cost: Decimal
    effective_on: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LaborCostSummaryResponse(BaseModel):
    user_id: int
    member_name: str
    session_count: int
    total_cost: Decimal
