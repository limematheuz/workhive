from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.inventory import InventoryMovement
from app.models.invoice import Invoice
from app.repositories import client_profitability as profitability_repo
from app.schemas.client_profitability import (
    ClientProfitabilityPeriod,
    ClientProfitabilityResponse,
    ClientProfitabilityRow,
)
from app.services.entitlement_service import require_company_feature
from app.services.reportable_sales_service import (
    manual_records_without_workhive_invoice,
)


MONEY = Decimal("0.01")
ZERO = Decimal("0")


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _period_range(period: str, reference_date: date) -> tuple[datetime, datetime]:
    if period == "month":
        start = datetime(
            reference_date.year, reference_date.month, 1, tzinfo=timezone.utc
        )
        if reference_date.month == 12:
            end = datetime(reference_date.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(
                reference_date.year, reference_date.month + 1, 1, tzinfo=timezone.utc
            )
        return start, end
    return (
        datetime(reference_date.year, 1, 1, tzinfo=timezone.utc),
        datetime(reference_date.year + 1, 1, 1, tzinfo=timezone.utc),
    )


def _previous_reference_date(period: str, reference_date: date) -> date:
    if period == "month":
        return (
            date(reference_date.year - 1, 12, 1)
            if reference_date.month == 1
            else date(reference_date.year, reference_date.month - 1, 1)
        )
    return date(reference_date.year - 1, 1, 1)


@dataclass
class _ClientTotals:
    client_id: int
    client_name: str
    invoice_count: int = 0
    direct_cost_count: int = 0
    revenue_base_amount: Decimal = ZERO
    direct_cost_base_amount: Decimal = ZERO

    def include_invoice(self, invoice: Invoice) -> None:
        self.invoice_count += 1
        self.revenue_base_amount += _decimal(invoice.base_amount)

    def include_expense(self, expense: Expense) -> None:
        self.direct_cost_count += 1
        self.direct_cost_base_amount += _decimal(expense.base_amount)

    def include_material_consumption(self, movement: InventoryMovement) -> None:
        self.direct_cost_count += 1
        self.direct_cost_base_amount += _decimal(movement.quantity) * _decimal(
            movement.unit_cost
        )

    def to_response(self) -> ClientProfitabilityRow:
        revenue = _money(self.revenue_base_amount)
        direct_cost = _money(self.direct_cost_base_amount)
        margin = _money(revenue - direct_cost)
        return ClientProfitabilityRow(
            client_id=self.client_id,
            client_name=self.client_name,
            invoice_count=self.invoice_count,
            direct_cost_count=self.direct_cost_count,
            revenue_base_amount=revenue,
            direct_cost_base_amount=direct_cost,
            known_margin_amount=margin,
            known_margin_percentage=(
                _money(margin * Decimal(100) / revenue) if revenue else None
            ),
        )


def _get_client_totals(
    totals: dict[int, _ClientTotals],
    *,
    client_id: int,
    client_name: str,
) -> _ClientTotals:
    existing = totals.get(client_id)
    if existing:
        return existing
    created = _ClientTotals(client_id=client_id, client_name=client_name)
    totals[client_id] = created
    return created


def _summarize_period(
    db: Session,
    company_id: int,
    *,
    start: datetime,
    end: datetime,
) -> ClientProfitabilityPeriod:
    invoices = profitability_repo.list_reportable_invoices(
        db, company_id, start=start, end=end
    )
    expenses = profitability_repo.list_expenses(db, company_id, start=start, end=end)
    material_consumptions = profitability_repo.list_unreversed_material_consumptions(
        db, company_id, start=start, end=end
    )
    manual_records = profitability_repo.list_active_manual_sales_records(
        db, company_id, start=start, end=end
    )
    client_totals: dict[int, _ClientTotals] = {}
    for invoice in invoices:
        if not invoice.client:
            continue
        _get_client_totals(
            client_totals,
            client_id=invoice.client_id,
            client_name=invoice.client.name,
        ).include_invoice(invoice)

    unassigned_expenses = ZERO
    for expense in expenses:
        if expense.client_id is None or expense.client is None:
            unassigned_expenses += _decimal(expense.base_amount)
            continue
        _get_client_totals(
            client_totals,
            client_id=expense.client_id,
            client_name=expense.client.name,
        ).include_expense(expense)

    unassigned_material_costs = ZERO
    for movement, client in material_consumptions:
        material_cost = _decimal(movement.quantity) * _decimal(movement.unit_cost)
        if movement.client_id is None or client is None:
            unassigned_material_costs += material_cost
            continue
        _get_client_totals(
            client_totals,
            client_id=client.id,
            client_name=client.name,
        ).include_material_consumption(movement)

    unlinked_historical_sales = sum(
        (
            _decimal(record.base_amount)
            for record in manual_records_without_workhive_invoice(
                invoices, manual_records
            )
        ),
        ZERO,
    )
    rows = [totals.to_response() for totals in client_totals.values()]
    rows.sort(
        key=lambda item: (
            -item.known_margin_amount,
            -item.revenue_base_amount,
            item.client_name.casefold(),
        )
    )
    revenue = sum((row.revenue_base_amount for row in rows), ZERO)
    direct_cost = sum((row.direct_cost_base_amount for row in rows), ZERO)
    margin = _money(revenue - direct_cost)
    return ClientProfitabilityPeriod(
        revenue_base_amount=_money(revenue),
        direct_cost_base_amount=_money(direct_cost),
        known_margin_amount=margin,
        known_margin_percentage=(
            _money(margin * Decimal(100) / revenue) if revenue else None
        ),
        client_count=len(rows),
        unassigned_expense_base_amount=_money(unassigned_expenses),
        unassigned_material_cost_base_amount=_money(unassigned_material_costs),
        unlinked_historical_sales_base_amount=_money(unlinked_historical_sales),
        clients=rows,
    )


def get_client_profitability(
    db: Session,
    company_id: int,
    *,
    period: str,
    reference_date: date,
) -> ClientProfitabilityResponse:
    require_company_feature(
        db,
        company_id=company_id,
        code="features.profitability",
    )
    current_start, current_end = _period_range(period, reference_date)
    previous_start, previous_end = _period_range(
        period,
        _previous_reference_date(period, reference_date),
    )
    return ClientProfitabilityResponse(
        period=period,
        reference_date=reference_date,
        current=_summarize_period(
            db,
            company_id,
            start=current_start,
            end=current_end,
        ),
        previous=_summarize_period(
            db,
            company_id,
            start=previous_start,
            end=previous_end,
        ),
    )
