import logging
import tempfile
from io import BytesIO
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models.quote import Quote
from app.services.storage_service import get_object_storage, media_key_from_url


logger = logging.getLogger(__name__)

BRAND_BLUE = colors.HexColor("#2563EB")
BRAND_BLUE_DARK = colors.HexColor("#1D4ED8")
BRAND_BLUE_SOFT = colors.HexColor("#EFF6FF")
BRAND_BLUE_ROW = colors.HexColor("#F6F9FF")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#DCE5F2")
SURFACE = colors.HexColor("#F8FAFC")


def _money(value: Decimal | float | int | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"{amount:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _quantity(value: Decimal | float | int | None) -> str:
    return f"{Decimal(str(value or 0)):f}".rstrip("0").rstrip(".") or "0"


def _text(value: object | None, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    return escape(str(value)).replace("\n", "<br/>")


def _normalized(value: object | None) -> str:
    return " ".join(str(value or "").casefold().split())


def _details_without_repeated_name(name: str, details: str | None) -> str:
    lines = [line.strip() for line in (details or "").splitlines() if line.strip()]
    if lines and _normalized(lines[0]) == _normalized(name):
        lines.pop(0)
    return "<br/>".join(_text(line) for line in lines)


def _quote_dates_text(quote: Quote) -> str:
    issued_on = quote.created_at.strftime("%d/%m/%Y") if quote.created_at else "-"
    dates = f"Fecha: {issued_on}"
    if quote.valid_until:
        dates += f"<br/>Válido hasta: {quote.valid_until.strftime('%d/%m/%Y')}"
    return dates


def _company_details(quote: Quote) -> str:
    company = quote.company
    if not company:
        return ""
    parts = [
        f"NIF/CIF: {_text(company.tax_id)}",
        _text(company.address),
    ]
    location = " ".join(
        str(value) for value in (company.postal_code, company.city) if value
    )
    if location:
        parts.append(_text(location))
    if company.phone:
        parts.append(f"Tel.: {_text(company.phone)}")
    if company.email:
        parts.append(_text(company.email))
    return "<br/>".join(parts)


def _client_details(quote: Quote) -> str:
    client = quote.client
    if not client:
        return ""
    parts = []
    if client.legal_number:
        parts.append(f"NIF/CIF: {_text(client.legal_number)}")
    if client.address:
        parts.append(_text(client.address))
    location = " ".join(
        str(value) for value in (client.postal_code, client.city) if value
    )
    if location:
        parts.append(_text(location))
    if client.phone:
        parts.append(f"Tel.: {_text(client.phone)}")
    if client.email:
        parts.append(_text(client.email))
    return "<br/>".join(parts)


def _company_logo(quote: Quote) -> Image | None:
    logo_url = str(getattr(quote.company, "logo", "") or "")
    if not logo_url:
        return None
    try:
        key = media_key_from_url(logo_url)
        if not key:
            return None
        image = Image(BytesIO(get_object_storage().get(key).contents))
        image._restrictSize(35 * mm, 14 * mm)
        return image
    except Exception:
        logger.warning("Company logo is unavailable for quote PDF", exc_info=True)
        return None


def _document_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(document.leftMargin, 11 * mm, A4[0] - document.rightMargin, 11 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(document.leftMargin, 7 * mm, "Presupuesto enviado desde WorkHive")
    canvas.drawRightString(A4[0] - document.rightMargin, 7 * mm, f"Página {document.page}")
    canvas.restoreState()


def _party_card(label: str, name: str, details: str) -> list:
    return [
        Paragraph(label, ParagraphStyle(
            f"{label}Label", fontName="Helvetica-Bold", fontSize=7.2,
            leading=9, textColor=BRAND_BLUE, spaceAfter=2 * mm,
        )),
        Paragraph(f"<b>{_text(name)}</b>", ParagraphStyle(
            f"{label}Name", fontName="Helvetica-Bold", fontSize=9.2,
            leading=11.5, textColor=INK, spaceAfter=1.2 * mm,
        )),
        Paragraph(details or "-", ParagraphStyle(
            f"{label}Details", fontName="Helvetica", fontSize=7.6,
            leading=10, textColor=MUTED,
        )),
    ]


def generate_quote_email_pdf(quote: Quote) -> Path:
    """Build the single branded PDF used by quote downloads and email attachments."""
    with tempfile.NamedTemporaryFile(
        prefix=f"quote-{quote.id}-",
        suffix=".pdf",
        delete=False,
    ) as temporary_file:
        destination = Path(temporary_file.name)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "QuoteBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.2,
        leading=10.6, textColor=INK,
    ))
    styles.add(ParagraphStyle(
        "QuoteSmall", parent=styles["QuoteBody"], fontSize=7.3, leading=9.4,
        textColor=MUTED,
    ))
    styles.add(ParagraphStyle(
        "QuoteTitle", parent=styles["Heading2"], fontName="Helvetica-Bold",
        fontSize=13.2, leading=16, textColor=INK,
    ))
    styles.add(ParagraphStyle(
        "QuoteMeta", parent=styles["QuoteBody"], fontSize=7.5, leading=10,
        textColor=MUTED, alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        "QuoteMetaNumber", parent=styles["QuoteMeta"], fontName="Helvetica-Bold",
        fontSize=14.5, leading=16, textColor=INK,
    ))

    document = SimpleDocTemplate(
        str(destination),
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=11 * mm,
        bottomMargin=16 * mm,
        title=f"Presupuesto {quote.quote_number}",
        author=settings.PROJECT_NAME,
    )

    issuer_name = (quote.company.name if quote.company else settings.PROJECT_NAME).strip()
    recipient_name = (
        quote.client.name.strip()
        if quote.client and quote.client.name
        else (quote.custom_recipient_info or "Cliente").strip().split("\n", 1)[0]
    )
    logo = _company_logo(quote)
    brand_cell = [
        logo if logo else Paragraph(issuer_name, ParagraphStyle(
            "QuoteBrandName", fontName="Helvetica-Bold", fontSize=17,
            leading=19, textColor=INK,
        )),
        Spacer(1, 1.2 * mm),
        Paragraph("PROPUESTA DE SERVICIOS", ParagraphStyle(
            "QuoteBrandKicker", fontName="Helvetica-Bold", fontSize=7.2,
            leading=9, textColor=BRAND_BLUE, tracking=0.8,
        )),
    ]
    meta_cell = [
        Paragraph("PRESUPUESTO", ParagraphStyle(
            "QuoteMetaLabel", parent=styles["QuoteMeta"], fontName="Helvetica-Bold",
            fontSize=7, leading=9, textColor=BRAND_BLUE,
        )),
        Paragraph(_text(quote.quote_number), styles["QuoteMetaNumber"]),
        Spacer(1, 1.2 * mm),
        Paragraph(_quote_dates_text(quote), styles["QuoteMeta"]),
    ]
    header = Table([[brand_cell, meta_cell]], colWidths=[113 * mm, 69 * mm])
    header.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 2.2, BRAND_BLUE),
        ("BACKGROUND", (1, 0), (1, 0), BRAND_BLUE_SOFT),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#BFDBFE")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 8 * mm),
        ("LEFTPADDING", (1, 0), (1, 0), 5 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))

    issuer_details = _details_without_repeated_name(issuer_name, quote.custom_issuer_info)
    recipient_details = _details_without_repeated_name(recipient_name, quote.custom_recipient_info)
    parties = Table([[
        _party_card("EMISOR", issuer_name, issuer_details or _company_details(quote)),
        _party_card("CLIENTE", recipient_name, recipient_details or _client_details(quote)),
    ]], colWidths=[91 * mm, 91 * mm])
    parties.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.8 * mm),
    ]))

    service = Table([[
        Paragraph("SERVICIO PRESUPUESTADO", ParagraphStyle(
            "QuoteServiceLabel", parent=styles["QuoteBody"], fontName="Helvetica-Bold",
            fontSize=7.1, leading=8.5, textColor=BRAND_BLUE,
        )),
        Paragraph(_text(quote.title), styles["QuoteTitle"]),
    ]], colWidths=[35 * mm, 147 * mm])
    service.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_BLUE_SOFT),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, BRAND_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 4 * mm),
        ("RIGHTPADDING", (0, 0), (0, 0), 2 * mm),
        ("LEFTPADDING", (1, 0), (1, 0), 2 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2 * mm),
    ]))

    item_rows = [["SERVICIO", "CANT.", "PRECIO UNITARIO", "IMPORTE"]]
    for item in quote.items:
        item_rows.append([
            Paragraph(_text(item.description), styles["QuoteBody"]),
            _quantity(item.quantity),
            _money(item.unit_price),
            _money(item.subtotal),
        ])
    items = Table(item_rows, colWidths=[93 * mm, 18 * mm, 35.5 * mm, 35.5 * mm], repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("LEADING", (0, 0), (-1, 0), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_BLUE_ROW]),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.35 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.35 * mm),
    ]))

    total_rows = [["Base imponible", _money(quote.base_amount)]]
    surcharge_amount = Decimal("0")
    if quote.equivalence_surcharge:
        surcharge_amount = (
            Decimal(str(quote.base_amount or 0))
            * Decimal(str(quote.equivalence_surcharge))
            / Decimal("100")
        )
        total_rows.append([
            f"Recargo ({quote.equivalence_surcharge:g}%)",
            _money(surcharge_amount),
        ])
    vat_amount = Decimal(str(quote.tax_amount or 0)) - surcharge_amount
    total_rows.append([f"IVA ({quote.tax_rate * 100:.0f}%)", _money(vat_amount)])
    if quote.retention:
        retention = Decimal(str(quote.base_amount or 0)) * Decimal(str(quote.retention)) / Decimal("100")
        total_rows.append([f"Retención ({quote.retention:g}%)", f"-{_money(retention)}"])
    total_rows.append(["TOTAL PRESUPUESTO", _money(quote.total_amount)])
    totals = Table(total_rows, colWidths=[47 * mm, 43 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -2), SURFACE),
        ("BACKGROUND", (0, -1), (-1, -1), BRAND_BLUE_DARK),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 9.5),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
    ]))

    information_rows = []
    if quote.notes:
        information_rows.append([
            Paragraph("OBSERVACIONES DEL SERVICIO", ParagraphStyle(
                "QuoteNotesLabel", parent=styles["QuoteBody"], fontName="Helvetica-Bold",
                fontSize=6.8, leading=8.4, textColor=BRAND_BLUE,
            )),
            Paragraph(_text(quote.notes), styles["QuoteSmall"]),
        ])
    if quote.terms:
        information_rows.append([
            Paragraph("CONDICIONES", ParagraphStyle(
                "QuoteTermsLabel", parent=styles["QuoteBody"], fontName="Helvetica-Bold",
                fontSize=6.8, leading=8.4, textColor=BRAND_BLUE,
            )),
            Paragraph(_text(quote.terms), styles["QuoteSmall"]),
        ])
    information = None
    if information_rows:
        information = Table(information_rows, colWidths=[37 * mm, 145 * mm])
        information.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), BRAND_BLUE_SOFT),
            ("BACKGROUND", (1, 0), (1, -1), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
        ]))

    acceptance = Table([[
        Paragraph(
            "Para aceptar este presupuesto, responda a este email o contacte con nosotros. "
            "La aceptación confirma los servicios y condiciones indicados.",
            styles["QuoteSmall"],
        )
    ]], colWidths=[182 * mm])
    acceptance.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("LINEABOVE", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3 * mm),
    ]))

    story = [
        header,
        Spacer(1, 4 * mm),
        parties,
        Spacer(1, 4 * mm),
        service,
        Spacer(1, 3.5 * mm),
        items,
        Spacer(1, 3.5 * mm),
        totals,
    ]
    if information:
        story.extend([Spacer(1, 4 * mm), information])
    story.extend([Spacer(1, 4 * mm), KeepTogether(acceptance)])
    document.build(story, onFirstPage=_document_footer, onLaterPages=_document_footer)
    return destination
