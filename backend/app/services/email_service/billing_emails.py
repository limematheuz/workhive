from collections.abc import Sequence
from email.message import EmailMessage
from html import escape
from pathlib import Path

from app.services.email_service import transport
from app.services.email_service.layout import _BRAND, base_layout, plain_body


def send_invoice_email(
    *,
    recipient_email: str | Sequence[str],
    recipient_name: str,
    issuer_name: str,
    invoice_number: str,
    pdf_path: Path,
    subject: str | None = None,
    custom_message: str | None = None,
    sender_copy_email: str | None = None,
    copy_emails: Sequence[str] | None = None,
    document_label: str = "Factura",
    locale: str = "es",
) -> bool:
    b = _BRAND
    is_english = locale == "en"
    copy = {
        "billing_details": "Billing details"
        if is_english
        else "Detalles de facturación",
        "document_number": "Document No." if is_english else "Nº de documento",
        "issuer": "Issuer" if is_english else "Emisor",
        "message": "Message" if is_english else "Mensaje",
        "attachment": (
            "You will find the PDF file attached to this email."
            if is_english
            else "Encontrarás el archivo PDF adjunto a este correo."
        ),
        "fallback_body": (
            f"We are attaching {document_label.lower()} {invoice_number} issued by {issuer_name}."
            if is_english
            else f"Adjuntamos {document_label.lower()} {invoice_number} emitida por {issuer_name}."
        ),
        "lead": (
            'Hi <strong style="color:{text};">{recipient}</strong>, we are sending the attached PDF document.'
            if is_english
            else 'Hola <strong style="color:{text};">{recipient}</strong>, te enviamos el documento adjunto en PDF.'
        ),
        "plain_greeting": "Hi" if is_english else "Hola",
        "plain_footer": (
            "This email was sent from WorkHive."
            if is_english
            else "Este correo se ha enviado desde WorkHive."
        ),
        "from_concept": "Billing" if is_english else "Facturación",
    }
    recipients = (
        [recipient_email]
        if isinstance(recipient_email, str)
        else [email for email in recipient_email if email]
    )
    if not recipients:
        return False
    document_label_text = document_label.strip() or "Factura"
    body_text = (
        custom_message.strip()
        if custom_message and custom_message.strip()
        else copy["fallback_body"]
    )
    safe_recipient_name = escape(recipient_name)
    safe_issuer_name = escape(issuer_name)
    safe_invoice_number = escape(invoice_number)
    safe_document_label = escape(document_label_text)
    safe_body_html = "<br>".join(escape(line) for line in body_text.splitlines())

    html_body = base_layout(
        f"""
<h1 class="email-h1 email-text-break" style="margin:0 0 12px;font-size:30px;line-height:36px;font-weight:800;color:{b["text"]};text-align:center;overflow-wrap:anywhere;word-break:break-word;">
  {safe_document_label} {safe_invoice_number}
</h1>
<p class="email-lead email-text-break" style="margin:0 0 30px;font-size:16px;color:{b["muted"]};text-align:center;line-height:25px;overflow-wrap:anywhere;word-break:break-word;">
  {copy["lead"].format(text=b["text"], recipient=safe_recipient_name)}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;border:1px solid {b["divider"]};border-radius:12px;overflow:hidden;background-color:{b["card"]};table-layout:fixed;">
<tr style="background-color:{b["inset_bg"]};">
  <td colspan="2" class="email-section-title" style="padding:14px 20px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:{b["muted"]};border-bottom:1px solid {b["divider"]};">
    {copy["billing_details"]}
  </td>
</tr>
<tr>
  <td class="email-detail-label" style="padding:16px 20px;font-size:14px;font-weight:700;color:{b["muted"]};width:150px;vertical-align:top;border-bottom:1px solid {b["divider"]};">{copy["document_number"]}:</td>
  <td class="email-detail-value email-text-break" style="padding:16px 20px;font-size:16px;color:{b["text"]};border-bottom:1px solid {b["divider"]};font-weight:800;overflow-wrap:anywhere;word-break:break-word;">{safe_invoice_number}</td>
</tr>
<tr>
  <td class="email-detail-label" style="padding:16px 20px;font-size:14px;font-weight:700;color:{b["muted"]};width:150px;vertical-align:top;">{copy["issuer"]}:</td>
  <td class="email-detail-value email-text-break" style="padding:16px 20px;font-size:16px;color:{b["text"]};font-weight:700;overflow-wrap:anywhere;word-break:break-word;">{safe_issuer_name}</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;border:1px solid {b["accent_border"]};border-radius:12px;background-color:{b["accent_soft"]};table-layout:fixed;">
<tr>
<td class="email-message-cell" style="padding:24px 26px;text-align:left;">
  <p style="margin:0 0 14px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:{b["accent"]};">{copy["message"]}:</p>
  <p class="email-message-body email-text-break" style="margin:0;font-size:16px;color:{b["text"]};line-height:26px;overflow-wrap:anywhere;word-break:break-word;">{safe_body_html}</p>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:1px solid {b["divider"]};border-radius:12px;background-color:{b["card"]};table-layout:fixed;">
<tr>
<td class="email-file-cell" style="padding:18px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="56" style="vertical-align:top;">
      <span style="display:inline-block;width:46px;height:46px;border-radius:12px;background-color:{b["accent_soft"]};color:{b["accent"]};font-size:11px;line-height:46px;text-align:center;font-weight:900;border:1px solid {b["accent_border"]};">PDF</span>
    </td>
    <td style="vertical-align:middle;">
      <p class="email-file-name email-text-break" style="margin:0 0 4px;font-size:15px;font-weight:800;color:{b["text"]};overflow-wrap:anywhere;word-break:break-word;">{safe_invoice_number}.pdf</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:{b["muted"]};">
        {copy["attachment"]}
      </p>
    </td>
  </tr>
  </table>
</td>
</tr>
</table>
""",
        preview_text=f"{document_label_text} {invoice_number} {'from' if is_english else 'de'} {issuer_name}",
        locale=locale,
    )

    plain_text = plain_body(
        [
            f"{copy['plain_greeting']} {recipient_name},",
            "",
            body_text,
            "",
            copy["plain_footer"],
        ],
        locale=locale,
    )

    message = EmailMessage()
    message["Subject"] = (
        subject or f"{document_label_text} {invoice_number} - {issuer_name}"
    )
    message["From"] = transport.from_address(copy["from_concept"])
    message["To"] = ", ".join(recipients)
    cc_recipients = list(copy_emails or [])
    if sender_copy_email:
        cc_recipients.append(sender_copy_email)
    cc_recipients = list(dict.fromkeys(email for email in cc_recipients if email))
    if cc_recipients:
        message["Cc"] = ", ".join(cc_recipients)
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    message.add_attachment(
        pdf_path.read_bytes(),
        maintype="application",
        subtype="pdf",
        filename=f"{invoice_number}.pdf",
    )
    return transport.send_email(message)
