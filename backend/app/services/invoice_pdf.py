import hashlib
import os
import tempfile
from types import SimpleNamespace
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models.invoice import Invoice


def _storage_root() -> Path:
    return Path(settings.INVOICE_PDF_STORAGE_PATH).expanduser().resolve()


def _money(value: Decimal | float | int | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"{amount:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _percentage(value: Decimal | float | int | None) -> str:
    percentage = Decimal(str(value or 0)) * Decimal("100")
    normalized = f"{percentage.quantize(Decimal('0.01')):f}".rstrip("0").rstrip(".")
    return f"{normalized}%"


def _quantity(value: Decimal | float | int | None) -> str:
    normalized = f"{Decimal(str(value or 0)):f}".rstrip("0").rstrip(".")
    return normalized or "0"


def _rate(value: Decimal | float | int | None) -> str:
    normalized = f"{Decimal(str(value or 0)):f}".rstrip("0").rstrip(".")
    return f"{normalized or '0'}%"


def _date(value: datetime | None) -> str:
    return value.strftime("%d/%m/%Y") if value else "-"


def _text(value: object | None, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    return escape(str(value)).replace("\n", "<br/>")


def _concept_description(value: object | None) -> str:
    """Keep the service title visually stronger than location/time details."""
    text = _text(value)
    if text == "-":
        return text
    title, separator, rest = text.partition("<br/>")
    if not separator:
        return f"<b>{title}</b>"
    return f"<b>{title}</b><br/>{rest}"


def _party_block(title: str, snapshot: dict | None) -> list:
    party = snapshot or {}
    location = " ".join(
        str(value)
        for value in (
            party.get("postal_code"),
            party.get("city"),
            party.get("country"),
        )
        if value
    )
    details = [
        f"<b>{_text(party.get('name'))}</b>",
        f"NIF/CIF: {_text(party.get('tax_id'))}",
        _text(party.get("address")),
    ]
    if location:
        details.append(_text(location))
    if party.get("email"):
        details.append(_text(party["email"]))
    return [
        Paragraph(title, ParagraphStyle("PartyTitle", fontSize=8, textColor=colors.HexColor("#475569"))),
        Spacer(1, 2 * mm),
        Paragraph("<br/>".join(details), ParagraphStyle("Party", fontSize=9, leading=13)),
    ]


def _qr_drawing(value: str) -> Drawing:
    size = 35 * mm
    widget = QrCodeWidget(value, barLevel="M")
    x1, y1, x2, y2 = widget.getBounds()
    width = x2 - x1
    height = y2 - y1
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def _build_pdf(invoice: Invoice, destination: Path) -> None:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "InvoiceTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1d4ed8"),
            alignment=TA_RIGHT,
        )
    )
    styles.add(
        ParagraphStyle(
            "SmallRight",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#475569"),
        )
    )
    styles.add(
        ParagraphStyle(
            "BodySmall",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
        )
    )

    document = SimpleDocTemplate(
        str(destination),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Factura {invoice.invoice_number}",
        author=settings.PROJECT_NAME,
    )
    story: list = []
    if invoice.qr_url:
        qr_caption = Paragraph(
            "<b>QR tributario:</b>",
            ParagraphStyle(
                "QrCaption",
                parent=styles["BodySmall"],
                alignment=1,
                fontSize=8,
                leading=10,
            ),
        )
        verifactu_caption = Paragraph(
            "<b>VERI*FACTU</b><br/>"
            "Factura verificable en la sede electrónica de la AEAT",
            ParagraphStyle(
                "VerifactuCaption",
                parent=styles["BodySmall"],
                alignment=1,
                fontSize=7,
                leading=9,
            ),
        )
        qr_block = Table(
            [[qr_caption], [_qr_drawing(invoice.qr_url)], [verifactu_caption]],
            colWidths=[47 * mm],
            hAlign="CENTER",
        )
        qr_block.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
                ]
            )
        )
        story.extend([qr_block, Spacer(1, 5 * mm)])

    invoice_label = getattr(invoice, "document_label", None) or (
        "FACTURA RECTIFICATIVA" if invoice.is_rectification else "FACTURA"
    )
    header = Table(
        [
            [
                Paragraph(
                    f"<b>{_text((invoice.issuer_snapshot or {}).get('name'), settings.PROJECT_NAME)}</b>",
                    styles["Heading2"],
                ),
                Paragraph(invoice_label, styles["InvoiceTitle"]),
            ],
            [
                Paragraph(
                    f"NIF/CIF: {_text((invoice.issuer_snapshot or {}).get('tax_id'))}",
                    styles["BodySmall"],
                ),
                Paragraph(
                    f"<b>{_text(invoice.invoice_number)}</b><br/>"
                    f"Fecha: {_date(invoice.issue_date)}<br/>"
                    f"Vencimiento: {_date(invoice.due_date)}",
                    styles["SmallRight"],
                ),
            ],
        ],
        colWidths=[94 * mm, 80 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#bfdbfe")),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 8 * mm),
            ]
        )
    )
    story.extend([header, Spacer(1, 8 * mm)])

    party_table = Table(
        [
            [
                _party_block("EMISOR", invoice.issuer_snapshot),
                _party_block("CLIENTE", invoice.recipient_snapshot),
            ]
        ],
        colWidths=[87 * mm, 87 * mm],
    )
    party_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story.extend([party_table, Spacer(1, 8 * mm)])

    item_rows = [
        [
            Paragraph("<b>Concepto</b>", styles["BodySmall"]),
            Paragraph("<b>Cant.</b>", styles["BodySmall"]),
            Paragraph("<b>Precio</b>", styles["BodySmall"]),
            Paragraph("<b>IVA</b>", styles["BodySmall"]),
            Paragraph("<b>Total</b>", styles["BodySmall"]),
        ]
    ]
    for item in invoice.items:
        item_rows.append(
            [
                Paragraph(_concept_description(item.description), styles["BodySmall"]),
                Paragraph(_quantity(item.quantity), styles["BodySmall"]),
                Paragraph(_money(item.unit_price), styles["SmallRight"]),
                Paragraph(_percentage(item.tax_rate), styles["SmallRight"]),
                Paragraph(_money(item.total), styles["SmallRight"]),
            ]
        )
    items_table = Table(
        item_rows,
        colWidths=[78 * mm, 18 * mm, 28 * mm, 20 * mm, 30 * mm],
        repeatRows=1,
    )
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.extend([items_table, Spacer(1, 6 * mm)])

    totals = [
        ["Base imponible", _money(invoice.base_amount)],
        ["IVA", _money(invoice.tax_amount)],
    ]
    if invoice.discount:
        totals.append(["Descuento", _rate(invoice.discount)])
    if invoice.equivalence_surcharge:
        totals.append(["Recargo de equivalencia", _rate(invoice.equivalence_surcharge)])
    if invoice.retention:
        totals.append(["Retención", _rate(invoice.retention)])
    totals.append(["TOTAL", _money(invoice.total_amount)])
    totals_table = Table(totals, colWidths=[48 * mm, 38 * mm], hAlign="RIGHT")
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1d4ed8")),
                ("TOPPADDING", (0, -1), (-1, -1), 3 * mm),
            ]
        )
    )
    story.append(totals_table)

    footer_blocks = []
    if invoice.shipping_address:
        footer_blocks.append(
            Paragraph(
                f"<b>Dirección de servicio:</b><br/>{_text(invoice.shipping_address)}",
                styles["BodySmall"],
            )
        )
    if invoice.rectification_reason:
        footer_blocks.append(
            Paragraph(
                f"<b>Motivo de rectificación:</b><br/>{_text(invoice.rectification_reason)}",
                styles["BodySmall"],
            )
        )
    if invoice.notes:
        footer_blocks.append(
            Paragraph(f"<b>Notas:</b><br/>{_text(invoice.notes)}", styles["BodySmall"])
        )
    if invoice.terms:
        footer_blocks.append(
            Paragraph(
                f"<b>Términos:</b><br/>{_text(invoice.terms)}",
                styles["BodySmall"],
            )
        )
    bank_account = (invoice.issuer_snapshot or {}).get("bank_account")
    swift_bic = (invoice.issuer_snapshot or {}).get("swift_bic")
    if bank_account or swift_bic:
        payment_details = []
        if bank_account:
            payment_details.append(f"Cuenta / IBAN: {_text(bank_account)}")
        if swift_bic:
            payment_details.append(f"SWIFT/BIC: {_text(swift_bic)}")
        footer_blocks.append(
            Paragraph(
                f"<b>Pago por transferencia:</b> {' · '.join(payment_details)}",
                styles["BodySmall"],
            )
        )
    if invoice.invoice_hash:
        footer_blocks.append(
            Paragraph(
                f"<b>Huella del registro:</b> {_text(invoice.invoice_hash)}",
                ParagraphStyle(
                    "Hash",
                    parent=styles["BodySmall"],
                    fontName="Courier",
                    fontSize=6,
                    leading=8,
                    wordWrap="CJK",
                ),
            )
        )
    if footer_blocks:
        story.extend(
            [
                Spacer(1, 8 * mm),
                KeepTogether(
                    [
                        Table(
                            [[block] for block in footer_blocks],
                            colWidths=[174 * mm],
                            style=TableStyle(
                                [
                                    ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
                                    ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                                    ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                                    ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                                ]
                            ),
                        )
                    ]
                ),
            ]
        )
    def draw_page_footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(
            18 * mm,
            9 * mm,
            f"{invoice_label.title()} {invoice.invoice_number}",
        )
        canvas.drawRightString(
            A4[0] - 18 * mm,
            9 * mm,
            f"Página {doc.page}",
        )
        canvas.restoreState()

    document.build(
        story,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )


def generate_invoice_pdf(invoice: Invoice) -> Path:
    if invoice.status not in {"issued", "paid", "overdue", "rectified"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invoice status does not have a definitive PDF",
        )
    if not invoice.issuer_snapshot or not invoice.recipient_snapshot:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The invoice is missing immutable issuer or recipient data",
        )

    root = _storage_root()
    company_directory = root / str(invoice.company_id)
    company_directory.mkdir(parents=True, exist_ok=True)
    destination = company_directory / f"invoice-{invoice.id}.pdf"
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".invoice-{invoice.id}-",
        suffix=".pdf",
        dir=company_directory,
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        _build_pdf(invoice, temporary)
        pdf_bytes = temporary.read_bytes()
        if not pdf_bytes.startswith(b"%PDF-"):
            raise RuntimeError("Generated invoice document is not a PDF")
        os.chmod(temporary, 0o600)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise

    invoice.pdf_path = str(destination)
    invoice.pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    invoice.pdf_generated_at = datetime.now(timezone.utc)
    return destination


def generate_invoice_preview_pdf(
    invoice: Invoice,
    issuer_snapshot: dict,
    recipient_snapshot: dict,
    *,
    document_label: str = "PROFORMA",
) -> Path:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".invoice-preview-{invoice.id}-",
        suffix=".pdf",
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    preview = SimpleNamespace(
        company_id=invoice.company_id,
        invoice_number=invoice.invoice_number,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        is_rectification=invoice.is_rectification,
        document_label=document_label,
        issuer_snapshot=issuer_snapshot,
        recipient_snapshot=recipient_snapshot,
        qr_url=None,
        invoice_hash=None,
        items=invoice.items,
        base_amount=invoice.base_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        discount=invoice.discount,
        equivalence_surcharge=invoice.equivalence_surcharge,
        retention=invoice.retention,
        shipping_address=invoice.shipping_address,
        rectification_reason=invoice.rectification_reason,
        notes=invoice.notes,
        terms=invoice.terms,
    )
    try:
        _build_pdf(preview, temporary)
        if not temporary.read_bytes().startswith(b"%PDF-"):
            raise RuntimeError("Generated invoice preview is not a PDF")
        os.chmod(temporary, 0o600)
        return temporary
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def resolve_invoice_pdf(invoice: Invoice) -> Path:
    if not invoice.pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The invoice PDF has not been generated",
        )
    root = _storage_root()
    path = Path(invoice.pdf_path).expanduser().resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The invoice PDF is unavailable",
        )
    return path
