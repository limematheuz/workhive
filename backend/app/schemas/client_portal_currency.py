"""Public original-currency values; internal document metadata stays private."""

from pydantic import BaseModel, Field


class ClientPortalCurrencyAmounts(BaseModel):
    base_amount: str | None = None
    tax_amount: str | None = None
    total_amount: str


class ClientPortalCurrencyLine(BaseModel):
    description: str
    quantity: str
    unit_price: str
    tax_rate: str | None = None
    subtotal: str
    total: str | None = None


class ClientPortalCurrencySnapshot(BaseModel):
    currency: str
    eur_rate: str
    rate_date: str
    original_amounts: ClientPortalCurrencyAmounts
    eur_amounts: ClientPortalCurrencyAmounts
    original_lines: list[ClientPortalCurrencyLine] = Field(default_factory=list)
    rounding_difference_eur: str | None = None
