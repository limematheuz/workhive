from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class ClientProfitabilityRow(BaseModel):
    client_id: int
    client_name: str
    invoice_count: int
    direct_cost_count: int
    revenue_base_amount: Decimal
    direct_cost_base_amount: Decimal
    known_margin_amount: Decimal
    known_margin_percentage: Decimal | None


class ClientProfitabilityPeriod(BaseModel):
    revenue_base_amount: Decimal
    direct_cost_base_amount: Decimal
    known_margin_amount: Decimal
    known_margin_percentage: Decimal | None
    client_count: int
    unassigned_expense_base_amount: Decimal
    unlinked_historical_sales_base_amount: Decimal
    clients: list[ClientProfitabilityRow]


class ClientProfitabilityResponse(BaseModel):
    period: Literal["month", "year"]
    reference_date: date
    current: ClientProfitabilityPeriod
    previous: ClientProfitabilityPeriod
