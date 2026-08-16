from decimal import Decimal

from pydantic import BaseModel, Field


class FiscalPeriodSummary(BaseModel):
    """Operational tax figures for one calendar period.

    Amounts are derived from issued accounting documents.  They are deliberately
    not presented as an AEAT filing or a deduction eligibility decision.
    """

    key: str
    label: str
    issued_invoice_count: int
    registered_expense_count: int
    output_base_amount: Decimal
    output_vat_amount: Decimal
    equivalence_surcharge_amount: Decimal
    registered_expense_base_amount: Decimal
    registered_input_vat_amount: Decimal
    estimated_vat_balance: Decimal
    withheld_irpf_amount: Decimal


class FiscalSummaryResponse(BaseModel):
    year: int = Field(ge=2000, le=2100)
    periods: list[FiscalPeriodSummary]
    annual: FiscalPeriodSummary
