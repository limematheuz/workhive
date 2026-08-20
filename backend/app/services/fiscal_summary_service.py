from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord
from app.repositories import fiscal_summary as fiscal_summary_repo
from app.schemas.fiscal_summary import FiscalPeriodSummary, FiscalSummaryResponse
from app.services.reportable_sales_service import manual_records_without_workhive_invoice


MONEY = Decimal("0.01")
ZERO = Decimal("0")
QUARTERS = (
    ("Q1", "T1"),
    ("Q2", "T2"),
    ("Q3", "T3"),
    ("Q4", "T4"),
)


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


@dataclass
class _Totals:
    issued_invoice_count: int = 0
    registered_expense_count: int = 0
    output_base_amount: Decimal = ZERO
    output_vat_amount: Decimal = ZERO
    equivalence_surcharge_amount: Decimal = ZERO
    registered_expense_base_amount: Decimal = ZERO
    registered_input_vat_amount: Decimal = ZERO
    withheld_irpf_amount: Decimal = ZERO

    def include_invoice(self, invoice: Invoice) -> None:
        base_amount = _decimal(invoice.base_amount)
        surcharge_amount = _money(
            base_amount * _decimal(invoice.equivalence_surcharge) / Decimal(100)
        )
        self.issued_invoice_count += 1
        self.output_base_amount += base_amount
        # Invoice.tax_amount stores VAT plus the equivalence surcharge. Keep both
        # figures explicit so the VAT balance is not overstated.
        self.output_vat_amount += _decimal(invoice.tax_amount) - surcharge_amount
        self.equivalence_surcharge_amount += surcharge_amount
        self.withheld_irpf_amount += _money(
            base_amount * _decimal(invoice.retention) / Decimal(100)
        )

    def include_expense(self, expense: Expense) -> None:
        self.registered_expense_count += 1
        self.registered_expense_base_amount += _decimal(expense.base_amount)
        self.registered_input_vat_amount += _decimal(expense.tax_amount)

    def include_manual_sales_record(self, record: SalesLedgerRecord) -> None:
        """Include imported history without inventing unsupported tax fields."""
        self.issued_invoice_count += 1
        self.output_base_amount += _decimal(record.base_amount)
        self.output_vat_amount += _decimal(record.tax_amount)

    def to_response(self, *, key: str, label: str) -> FiscalPeriodSummary:
        output_vat = _money(self.output_vat_amount)
        registered_input_vat = _money(self.registered_input_vat_amount)
        return FiscalPeriodSummary(
            key=key,
            label=label,
            issued_invoice_count=self.issued_invoice_count,
            registered_expense_count=self.registered_expense_count,
            output_base_amount=_money(self.output_base_amount),
            output_vat_amount=output_vat,
            equivalence_surcharge_amount=_money(self.equivalence_surcharge_amount),
            registered_expense_base_amount=_money(self.registered_expense_base_amount),
            registered_input_vat_amount=registered_input_vat,
            estimated_vat_balance=_money(output_vat - registered_input_vat),
            withheld_irpf_amount=_money(self.withheld_irpf_amount),
        )


def _quarter_index(month: int) -> int:
    return (month - 1) // 3


def _year_range(year: int) -> tuple[datetime, datetime]:
    return (
        datetime(year, 1, 1, tzinfo=timezone.utc),
        datetime(year + 1, 1, 1, tzinfo=timezone.utc),
    )


def get_summary(
    db: Session,
    company_id: int,
    *,
    year: int,
) -> FiscalSummaryResponse:
    start, end = _year_range(year)
    quarterly_totals = [_Totals() for _ in QUARTERS]

    invoices = fiscal_summary_repo.get_reportable_invoices(
        db,
        company_id,
        start=start,
        end=end,
    )
    for invoice in invoices:
        quarterly_totals[_quarter_index(invoice.issue_date.month)].include_invoice(invoice)

    manual_records = fiscal_summary_repo.get_active_manual_sales_records(
        db,
        company_id,
        start=start,
        end=end,
    )
    for record in manual_records_without_workhive_invoice(invoices, manual_records):
        quarterly_totals[_quarter_index(record.entry_date.month)].include_manual_sales_record(record)

    for expense in fiscal_summary_repo.get_registered_expenses(
        db,
        company_id,
        start=start,
        end=end,
    ):
        quarterly_totals[_quarter_index(expense.expense_date.month)].include_expense(expense)

    periods = [
        totals.to_response(key=key, label=label)
        for totals, (key, label) in zip(quarterly_totals, QUARTERS)
    ]
    annual = _Totals()
    for totals in quarterly_totals:
        annual.issued_invoice_count += totals.issued_invoice_count
        annual.registered_expense_count += totals.registered_expense_count
        annual.output_base_amount += totals.output_base_amount
        annual.output_vat_amount += totals.output_vat_amount
        annual.equivalence_surcharge_amount += totals.equivalence_surcharge_amount
        annual.registered_expense_base_amount += totals.registered_expense_base_amount
        annual.registered_input_vat_amount += totals.registered_input_vat_amount
        annual.withheld_irpf_amount += totals.withheld_irpf_amount

    return FiscalSummaryResponse(
        year=year,
        periods=periods,
        annual=annual.to_response(key="annual", label=str(year)),
    )
