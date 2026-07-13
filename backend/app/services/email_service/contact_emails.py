import logging
from email.message import EmailMessage
from html import escape

from app.core.config import settings
from app.services.email_service import transport
from app.services.email_service.layout import _BRAND, base_layout, button

logger = logging.getLogger(__name__)


def send_contact_email(
    sender_name: str,
    sender_email: str,
    subject: str,
    body: str,
) -> bool:
    if not settings.CONTACT_RECIPIENT_EMAIL:
        logger.warning("Contact recipient is not configured; email was not sent")
        return False

    b = _BRAND
    safe_sender_name = escape(sender_name)
    safe_sender_email = escape(sender_email, quote=True)
    safe_subject = escape(subject)
    escaped_body = escape(body).replace("\n", "<br>")

    html_body = base_layout(
        f"""
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{b['text']};text-align:center;">
  Nuevo mensaje de contacto
</h1>
<p style="margin:0 0 24px;font-size:14px;color:{b['muted']};text-align:center;line-height:22px;">
  Has recibido un mensaje a través del formulario de soporte de WorkHive.
</p>

<!-- Info fields table -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid {b['divider']};border-radius:8px;overflow:hidden;background-color:#ffffff;">
<tr style="background-color:#f9fafb;">
  <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:{b['muted']};border-bottom:1px solid {b['divider']};">
    Detalles del remitente
  </td>
</tr>
<tr>
  <td style="padding:12px 16px;font-size:12px;font-weight:600;color:{b['muted']};width:80px;vertical-align:top;border-bottom:1px solid {b['divider']};">Nombre:</td>
  <td style="padding:12px 16px;font-size:13px;color:{b['text']};border-bottom:1px solid {b['divider']};">{safe_sender_name}</td>
</tr>
<tr>
  <td style="padding:12px 16px;font-size:12px;font-weight:600;color:{b['muted']};width:80px;vertical-align:top;border-bottom:1px solid {b['divider']};">Email:</td>
  <td style="padding:12px 16px;font-size:13px;border-bottom:1px solid {b['divider']};"><a href="mailto:{safe_sender_email}" style="color:{b['accent']};text-decoration:none;font-weight:600;">{safe_sender_email}</a></td>
</tr>
<tr>
  <td style="padding:12px 16px;font-size:12px;font-weight:600;color:{b['muted']};width:80px;vertical-align:top;">Asunto:</td>
  <td style="padding:12px 16px;font-size:13px;color:{b['text']};">{safe_subject}</td>
</tr>
</table>

<!-- Message block (Blue highlight) -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:{b['accent']};">Mensaje:</p>
  <p style="margin:0;font-size:14px;color:{b['text']};line-height:22px;">{escaped_body}</p>
</td>
</tr>
</table>

{button(f"mailto:{sender_email}", "Responder por correo")}
""",
        preview_text=f"Mensaje de {sender_name}: {subject}",
    )

    plain_text = "\n".join([
        "Nuevo mensaje recibido desde el formulario de WorkHive.",
        "",
        f"Nombre: {sender_name}",
        f"Email: {sender_email}",
        f"Asunto: {subject}",
        "",
        body,
    ])

    message = EmailMessage()
    message["Subject"] = f"[WorkHive Contact] {subject}"
    message["From"] = transport.from_address("Soporte")
    message["To"] = settings.CONTACT_RECIPIENT_EMAIL
    message["Reply-To"] = sender_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
