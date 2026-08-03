import tempfile
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models.quote import Quote


def _money(value: Decimal | float | int | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"{amount:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _text(value: object | None, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    return escape(str(value)).replace("\n", "<br/>")


def generate_quote_email_pdf(quote: Quote) -> Path:
    with tempfile.NamedTemporaryFile(
        prefix=f"quote-{quote.id}-",
        suffix=".pdf",
        delete=False,
    ) as temporary_file:
        destination = Path(temporary_file.name)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "QuoteTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1d4ed8"),
            alignment=TA_RIGHT,
        )
    )
    styles.add(ParagraphStyle("QuoteBody", parent=styles["Normal"], fontSize=8, leading=11))
    styles.add(
        ParagraphStyle(
            "QuoteRight",
            parent=styles["QuoteBody"],
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#475569"),
        )
    )
    document = SimpleDocTemplate(
        str(destination),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Presupuesto {quote.quote_number}",
        author=settings.PROJECT_NAME,
    )
    issuer_name = quote.company.name if quote.company else settings.PROJECT_NAME
    recipient_name = (
        quote.client.name
        if quote.client
        else (quote.custom_recipient_info or "Cliente")
    )
    header = Table(
        [
            [
                Paragraph(f"<b>{_text(issuer_name)}</b>", styles["Heading2"]),
                Paragraph("PRESUPUESTO", styles["QuoteTitle"]),
            ],
            [
                Paragraph(_text(quote.custom_issuer_info), styles["QuoteBody"]),
                Paragraph(
                    f"<b>{_text(quote.quote_number)}</b><br/>"
                    f"Fecha: {_text(quote.created_at.strftime('%d/%m/%Y') if quote.created_at else None)}<br/>"
                    f"Válido hasta: {_text(quote.valid_until.strftime('%d/%m/%Y') if quote.valid_until else None)}",
                    styles["QuoteRight"],
                ),
            ],
        ],
        colWidths=[94 * mm, 80 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#bfdbfe")), ("BOTTOMPADDING", (0, -1), (-1, -1), 8 * mm)]))
    recipient = Table(
        [[Paragraph("<b>CLIENTE</b><br/>" + _text(recipient_name), styles["QuoteBody"])]],
        colWidths=[174 * mm],
    )
    recipient.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")), ("PADDING", (0, 0), (-1, -1), 5 * mm)]))
    rows = [["Concepto", "Cant.", "Precio", "Total"]]
    for item in quote.items:
        rows.append([
            Paragraph(_text(item.description), styles["QuoteBody"]),
            str(item.quantity),
            _money(item.unit_price),
            _money(item.subtotal),
        ])
    items = Table(rows, colWidths=[92 * mm, 20 * mm, 30 * mm, 32 * mm], repeatRows=1)
    items.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")), ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    totals = Table(
        [["Base imponible", _money(quote.base_amount)], ["IVA", _money(quote.tax_amount)], ["TOTAL", _money(quote.total_amount)]],
        colWidths=[48 * mm, 38 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1d4ed8"))]))
    story = [header, Spacer(1, 8 * mm), recipient, Spacer(1, 8 * mm), items, Spacer(1, 6 * mm), totals]
    if quote.notes:
        story.extend([Spacer(1, 8 * mm), Paragraph(f"<b>Notas:</b><br/>{_text(quote.notes)}", styles["QuoteBody"])])
    if quote.terms:
        story.extend([Spacer(1, 4 * mm), Paragraph(f"<b>Términos:</b><br/>{_text(quote.terms)}", styles["QuoteBody"])])
    document.build(story)
    return destination
