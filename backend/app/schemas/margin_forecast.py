from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MarginForecastUpsert(BaseModel):
    planned_direct_cost_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    notes: str | None = Field(default=None, max_length=2_000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class MarginForecastBudgetResponse(BaseModel):
    id: int
    planned_direct_cost_amount: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MarginForecastResponse(BaseModel):
    scope_type: Literal["contract", "work_order"]
    scope_id: int
    scope_name: str
    budget: MarginForecastBudgetResponse | None
    planned_revenue_base_amount: Decimal | None
    planned_direct_cost_base_amount: Decimal | None
    planned_margin_base_amount: Decimal | None
    actual_revenue_base_amount: Decimal
    actual_labor_cost_base_amount: Decimal
    actual_material_cost_base_amount: Decimal
    actual_expense_cost_base_amount: Decimal
    actual_direct_cost_base_amount: Decimal
    actual_margin_base_amount: Decimal
    direct_cost_variance_base_amount: Decimal | None


class ServiceMarginScopeResponse(BaseModel):
    id: int
    name: str
    version: int


class ServiceMarginResponse(BaseModel):
    """Known, task-traced margin for an immutable service revision."""

    scope_type: Literal["service"]
    scope_id: int
    scope_name: str
    actual_revenue_base_amount: Decimal
    actual_labor_cost_base_amount: Decimal
    known_direct_cost_base_amount: Decimal
    known_margin_base_amount: Decimal


class TeamLaborCostResponse(BaseModel):
    """Closed labour cost traced to the team responsible for a location."""

    team_id: int
    team_name: str
    work_session_count: int
    actual_labor_cost_base_amount: Decimal


class LocationMarginResponse(BaseModel):
    """Read-only actual margin for one location without cost allocations."""

    scope_type: Literal["location"]
    scope_id: int
    scope_name: str
    actual_revenue_base_amount: Decimal
    actual_labor_cost_base_amount: Decimal
    actual_material_cost_base_amount: Decimal
    actual_expense_cost_base_amount: Decimal
    actual_direct_cost_base_amount: Decimal
    actual_margin_base_amount: Decimal
