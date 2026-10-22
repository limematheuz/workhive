from decimal import Decimal
from types import SimpleNamespace

from app.services.quote_pdf_amounts import (
    format_quote_money,
    format_quote_quantity,
    quote_total_rows,
)


def test_quote_pdf_amounts_keep_spanish_display_format():
    assert format_quote_money(Decimal("1234.50")) == "1.234,50 EUR"
    assert format_quote_quantity(Decimal("2.500")) == "2.5"
    assert format_quote_quantity(Decimal("0")) == "0"


def test_quote_pdf_breakdown_keeps_surcharge_vat_and_retention_separate():
    quote = SimpleNamespace(
        base_amount=Decimal("100.00"),
        tax_amount=Decimal("26.20"),
        tax_rate=Decimal("0.21"),
        equivalence_surcharge=Decimal("5.20"),
        retention=Decimal("10"),
        total_amount=Decimal("116.20"),
    )

    assert quote_total_rows(quote) == [
        ["Base imponible", "100,00 EUR"],
        ["Recargo (5.20%)", "5,20 EUR"],
        ["IVA (21%)", "21,00 EUR"],
        ["Retención (10%)", "-10,00 EUR"],
        ["TOTAL PRESUPUESTO", "116,20 EUR"],
    ]


def test_quote_pdf_breakdown_without_optional_adjustments():
    quote = SimpleNamespace(
        base_amount=Decimal("10"),
        tax_amount=Decimal("2.10"),
        tax_rate=Decimal("0.21"),
        equivalence_surcharge=None,
        retention=None,
        total_amount=Decimal("12.10"),
    )

    assert quote_total_rows(quote) == [
        ["Base imponible", "10,00 EUR"],
        ["IVA (21%)", "2,10 EUR"],
        ["TOTAL PRESUPUESTO", "12,10 EUR"],
    ]
