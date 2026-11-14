"""Money formatting and financial breakdown for the quote PDF."""

from decimal import Decimal

from app.models.quote import Quote


def format_quote_money(value: Decimal | float | int | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"{amount:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def format_quote_quantity(value: Decimal | float | int | None) -> str:
    formatted = f"{Decimal(str(value or 0)):f}"
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted or "0"


def quote_total_rows(quote: Quote) -> list[list[str]]:
    rows: list[list[str]] = []
    discount_pct = Decimal(str(getattr(quote, "discount", 0) or 0))
    if discount_pct > 0:
        items = getattr(quote, "items", None) or []
        if items:
            lines_subtotal = sum(
                (Decimal(str(getattr(item, "subtotal", 0) or 0)) for item in items),
                Decimal("0"),
            )
        elif discount_pct < Decimal("100"):
            lines_subtotal = Decimal(str(quote.base_amount or 0)) / (
                Decimal("1") - discount_pct / Decimal("100")
            )
        else:
            lines_subtotal = Decimal("0")
        discount_amount = lines_subtotal * (discount_pct / Decimal("100"))
        rows.append(["Subtotal", format_quote_money(lines_subtotal)])
        rows.append([
            f"Descuento ({format_quote_quantity(discount_pct)}%)",
            f"-{format_quote_money(discount_amount)}",
        ])

    rows.append(["Base imponible", format_quote_money(quote.base_amount)])
    surcharge_amount = Decimal("0")
    if quote.equivalence_surcharge:
        surcharge_amount = (
            Decimal(str(quote.base_amount or 0))
            * Decimal(str(quote.equivalence_surcharge))
            / Decimal("100")
        )
        rows.append([
            f"Recargo ({quote.equivalence_surcharge:g}%)",
            format_quote_money(surcharge_amount),
        ])
    vat_amount = Decimal(str(quote.tax_amount or 0)) - surcharge_amount
    rows.append([f"IVA ({quote.tax_rate * 100:.0f}%)", format_quote_money(vat_amount)])
    if quote.retention:
        retention = Decimal(str(quote.base_amount or 0)) * Decimal(str(quote.retention)) / Decimal("100")
        rows.append([f"Retención ({quote.retention:g}%)", f"-{format_quote_money(retention)}"])
    rows.append(["TOTAL PRESUPUESTO", format_quote_money(quote.total_amount)])
    return rows
