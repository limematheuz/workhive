"""PDF of the same public immutable manifest shown in the customer portal."""
from io import BytesIO
from html import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def build(part):
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    manifest = part["manifest"]
    story = []
    def paragraph(value, style="BodyText"):
        story.append(Paragraph(escape(str(value), quote=False).replace("\n", "<br/>"), styles[style]))
    paragraph("Parte de servicio", "Title")
    paragraph(manifest["title"], "Heading2")
    paragraph(f"{manifest['location_name']} · Trabajo #{manifest['task_id']} · Revisión {part['revision']}")
    paragraph(f"Cierre del trabajo: {manifest['completed_at']}")
    paragraph(f"Publicado: {part['published_at']}")
    story.append(Spacer(1, 5*mm))
    paragraph("Resumen compartido", "Heading3"); paragraph(manifest["public_summary"])
    if manifest["checklist"]:
        paragraph("Tareas incluidas en esta revisión", "Heading3")
        for item in manifest["checklist"]:
            paragraph(f"{'Completada' if item['completed'] else 'Pendiente'} · {item.get('space_name') or 'General'} · {item['text']}")
    if manifest["reports"]:
        paragraph("Reportes seleccionados por el responsable", "Heading3")
        for report in manifest["reports"]:
            if report.get("title"): paragraph(report["title"], "Heading4")
            if report.get("text"): paragraph(report["text"])
            if report.get("checklist_label"): paragraph(report["checklist_label"])
    if manifest["photos"]:
        paragraph("Fotografías adjuntas en el portal privado", "Heading3")
        for photo in manifest["photos"]:
            paragraph(f"{photo['file_name']} · {photo['byte_size']} bytes")
    acceptance = part.get("acceptance")
    paragraph("Validación del cliente", "Heading3")
    paragraph(f"Validado por {acceptance['signer_name']} el {acceptance['accepted_at']}" if acceptance else "Pendiente de validación de esta revisión por el cliente.")
    def footer(canvas, _):
        canvas.saveState(); canvas.setFillColor(colors.HexColor("#64748B")); canvas.setFont("Helvetica", 7)
        canvas.drawString(18*mm, 11*mm, f"Manifiesto SHA-256: {part['manifest_hash']}")
        canvas.drawRightString(A4[0]-18*mm, 7*mm, f"WorkHive · {document.page}"); canvas.restoreState()
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
