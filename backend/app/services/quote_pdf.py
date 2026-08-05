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


NAVY = colors.HexColor("#0F172A")
BLUE = colors.HexColor("#2563EB")
BLUE_SOFT = colors.HexColor("#EFF6FF")
SLATE = colors.HexColor("#475569")
SLATE_LIGHT = colors.HexColor("#E2E8F0")
SURFACE = colors.HexColor("#F8FAFC")


def _money(value: Decimal | float | int | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"{amount:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _text(value: object | None, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    return escape(str(value)).replace("\n", "<br/>")


def _document_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(SLATE_LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(document.leftMargin, 12 * mm, A4[0] - document.rightMargin, 12 * mm)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(document.leftMargin, 8 * mm, "Presupuesto generado con WorkHive")
    canvas.drawRightString(A4[0] - document.rightMargin, 8 * mm, f"Página {document.page}")
    canvas.restoreState()


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
            "QuoteBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=12,
            textColor=NAVY,
        )
    )
    styles.add(
        ParagraphStyle(
            "QuoteSmall",
            parent=styles["QuoteBody"],
            fontSize=7.4,
            leading=10,
            textColor=SLATE,
        )
    )
    styles.add(
        ParagraphStyle(
            "QuoteLabel",
            parent=styles["QuoteBody"],
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=10,
            textColor=BLUE,
        )
    )
    styles.add(
        ParagraphStyle(
            "QuoteHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            textColor=NAVY,
            spaceAfter=0,
        )
    )
    styles.add(
        ParagraphStyle(
            "QuoteSection",
            parent=styles["QuoteBody"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=12,
            textColor=NAVY,
        )
    )
    styles.add(
        ParagraphStyle(
            "QuoteMeta",
            parent=styles["QuoteBody"],
            fontSize=8,
            leading=17,
            textColor=colors.white,
            alignment=TA_RIGHT,
        )
    )
    document = SimpleDocTemplate(
        str(destination),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=f"Presupuesto {quote.quote_number}",
        author=settings.PROJECT_NAME,
    )

    issuer_name = quote.company.name if quote.company else settings.PROJECT_NAME
    recipient_name = quote.client.name if quote.client else (quote.custom_recipient_info or "Cliente")
    issued_on = quote.created_at.strftime("%d/%m/%Y") if quote.created_at else "-"
    valid_until = quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else "Sin caducidad"

    header = Table(
        [[
            Paragraph(
                f"<font size='18'><b>{_text(issuer_name)}</b></font><br/>"
                "<font size='8'>PROPUESTA DE SERVICIOS</font>",
                ParagraphStyle("QuoteBrand", parent=styles["QuoteBody"], textColor=colors.white, leading=13),
            ),
            Paragraph(
                f"<font size='9'><b>PRESUPUESTO</b></font><br/>"
                f"<font size='17'><b>{_text(quote.quote_number)}</b></font><br/>"
                f"Fecha: {issued_on}<br/>Válido hasta: {valid_until}",
                styles["QuoteMeta"],
            ),
        ]],
        colWidths=[104 * mm, 70 * mm],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 7 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 6 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6 * mm),
    ]))

    parties = Table(
        [[
            Paragraph(
                f"<font color='#2563EB'><b>EMITIDO POR</b></font><br/><br/>"
                f"<b>{_text(issuer_name)}</b><br/>{_text(quote.custom_issuer_info)}",
                styles["QuoteBody"],
            ),
            Paragraph(
                f"<font color='#2563EB'><b>PREPARADO PARA</b></font><br/><br/>"
                f"<b>{_text(recipient_name)}</b><br/>{_text(quote.custom_recipient_info)}",
                styles["QuoteBody"],
            ),
        ]],
        colWidths=[87 * mm, 87 * mm],
    )
    parties.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5 * mm),
    ]))

    service = Table(
        [[
            Paragraph("SERVICIO PRESUPUESTADO", styles["QuoteLabel"]),
        ], [
            Paragraph(_text(quote.title), styles["QuoteHeading"]),
        ]],
        colWidths=[174 * mm],
    )
    service.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))

    rows = [["SERVICIO", "CANT.", "PRECIO UNITARIO", "IMPORTE"]]
    for item in quote.items:
        rows.append([
            Paragraph(_text(item.description), styles["QuoteBody"]),
            str(item.quantity),
            _money(item.unit_price),
            _money(item.subtotal),
        ])
    items = Table(rows, colWidths=[84 * mm, 20 * mm, 35 * mm, 35 * mm], repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, SLATE_LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))

    totals = Table(
        [
            ["Base imponible", _money(quote.base_amount)],
            [f"IVA ({quote.tax_rate * 100:.0f}%)", _money(quote.tax_amount)],
            ["TOTAL PRESUPUESTO", _money(quote.total_amount)],
        ],
        colWidths=[53 * mm, 42 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 1), SURFACE),
        ("BACKGROUND", (0, -1), (-1, -1), NAVY),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))

    story = [
        header,
        Spacer(1, 6 * mm),
        parties,
        Spacer(1, 6 * mm),
        service,
        Spacer(1, 6 * mm),
        items,
        Spacer(1, 5 * mm),
        totals,
    ]
    if quote.notes:
        notes = Table(
            [[Paragraph("OBSERVACIONES Y SERVICIOS", styles["QuoteSection"]), Paragraph(_text(quote.notes), styles["QuoteBody"])]],
            colWidths=[47 * mm, 127 * mm],
        )
        notes.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), BLUE_SOFT),
            ("BACKGROUND", (1, 0), (-1, -1), SURFACE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
            ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ]))
        story.extend([Spacer(1, 7 * mm), notes])
    if quote.terms:
        terms = Table(
            [[Paragraph("CONDICIONES DEL PRESUPUESTO", styles["QuoteSection"]), Paragraph(_text(quote.terms), styles["QuoteBody"])]],
            colWidths=[47 * mm, 127 * mm],
        )
        terms.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
            ("BACKGROUND", (1, 0), (-1, -1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
            ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ]))
        story.extend([Spacer(1, 4 * mm), terms])

    acceptance = Table(
        [[Paragraph(
            "Para aceptar este presupuesto, responda a este email o contacte con nosotros. "
            "La aceptación confirma los servicios y condiciones indicados.",
            styles["QuoteSmall"],
        )]],
        colWidths=[174 * mm],
    )
    acceptance.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("LINEABOVE", (0, 0), (-1, -1), 0.5, SLATE_LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.extend([Spacer(1, 7 * mm), acceptance])
    document.build(story, onFirstPage=_document_footer, onLaterPages=_document_footer)
    return destination
