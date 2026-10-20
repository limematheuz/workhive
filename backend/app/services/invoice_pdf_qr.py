"""Render a tax QR without overstating its AEAT verification status."""

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Table, TableStyle

from app.core.config import settings
from app.models.invoice import Invoice


def show_verifactu_legend(invoice: Invoice) -> bool:
    """The verification claim belongs only to an operational production mode."""
    if settings.VERIFACTU_ENVIRONMENT != "production":
        return False
    if invoice.fiscal_submission_status == "accepted":
        return True
    return (
        invoice.fiscal_submission_status == "pending_submission"
        and settings.VERIFACTU_AUTO_SUBMIT
    )


def _qr_drawing(value: str) -> Drawing:
    size = 35 * mm
    widget = QrCodeWidget(value, barLevel="M")
    x1, y1, x2, y2 = widget.getBounds()
    width = x2 - x1
    height = y2 - y1
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def tax_qr_block(invoice: Invoice, body_style: ParagraphStyle) -> Table:
    qr_caption = Paragraph(
        "<b>QR tributario:</b>",
        ParagraphStyle("QrCaption", parent=body_style, alignment=1, fontSize=8, leading=10),
    )
    rows = [[qr_caption], [_qr_drawing(invoice.qr_url)]]
    if show_verifactu_legend(invoice):
        rows.append([
            Paragraph(
                "<b>VERI*FACTU</b><br/>"
                "Factura verificable en la sede electrónica de la AEAT",
                ParagraphStyle(
                    "VerifactuCaption", parent=body_style, alignment=1, fontSize=7, leading=9,
                ),
            )
        ])
    block = Table(rows, colWidths=[47 * mm], hAlign="CENTER")
    block.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    return block
