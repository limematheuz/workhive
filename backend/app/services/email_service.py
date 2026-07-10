import logging
import smtplib
from collections.abc import Sequence
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from pathlib import Path
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Brand constants (light theme) ────────────────────────────────────────────

_BRAND = {
    "bg": "#f3f4f6",       # soft grey background
    "card": "#ffffff",     # pure white card
    "card_border": "#e5e7eb", # subtle border
    "accent": "#2563eb",   # WorkHive blue accent
    "accent_soft": "#eff6ff",
    "accent_border": "#bfdbfe",
    "text": "#111827",     # zinc-900 (main text)
    "muted": "#4b5563",    # zinc-600 (muted text)
    "divider": "#e5e7eb",
    "footer_bg": "#f9fafb", # zinc-50 (footer)
    "inset_bg": "#f3f4f6",  # light grey box background
}


def _get_logo_header() -> str:
    """Check if logo exists on disk, and render it inline, falling back to text."""
    logo_path = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "logo" / "black-logo.png"
    if logo_path.exists():
        return '<img src="cid:logo" alt="WorkHive" style="width:260px;max-width:100%;height:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />'
    return f'<span style="font-size:30px;font-weight:900;color:{_BRAND["text"]};letter-spacing:-0.8px;">WorkHive</span>'


def _add_logo_to_message(message: EmailMessage) -> None:
    """Proactively embed the black-logo.png file as an inline related part if referenced in HTML."""
    try:
        logo_path = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "logo" / "black-logo.png"
        if logo_path.exists():
            logo_data = logo_path.read_bytes()
            for part in message.walk():
                if part.get_content_type() != "text/html":
                    continue
                part.add_related(
                    logo_data,
                    maintype="image",
                    subtype="png",
                    cid="logo"
                )
                break
    except Exception as e:
        logger.warning(f"Could not embed inline logo: {e}")


def _base_layout(content: str, *, preview_text: str = "", locale: str = "es") -> str:
    """Wrap *content* in the shared WorkHive email shell (light theme)."""
    b = _BRAND
    header_html = _get_logo_header()
    html_lang = "en" if locale == "en" else "es"
    footer_text = (
        "Smart business management"
        if html_lang == "en"
        else "Gestión empresarial inteligente"
    )
    return f"""\
<!DOCTYPE html>
<html lang="{html_lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>WorkHive</title>
<style>
  body, table, td, p, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ border-collapse:collapse; }}
  img {{ border:0; outline:none; text-decoration:none; max-width:100%; height:auto; }}
  .email-text-break {{ overflow-wrap:anywhere; word-break:break-word; }}
  @media only screen and (max-width:600px) {{
    .email-outer {{ padding:20px 10px !important; }}
    .email-card {{ max-width:100% !important; border-radius:14px !important; }}
    .email-header {{ padding:24px 18px 20px !important; }}
    .email-body {{ padding:28px 18px !important; }}
    .email-footer {{ padding:18px !important; }}
    .email-logo img {{ width:210px !important; }}
    .email-h1 {{ font-size:24px !important; line-height:30px !important; }}
    .email-lead {{ font-size:14px !important; line-height:22px !important; margin-bottom:22px !important; }}
    .email-section-title {{ padding:12px 14px !important; font-size:11px !important; }}
    .email-detail-label,
    .email-detail-value {{
      display:block !important;
      width:auto !important;
      padding:12px 14px !important;
      box-sizing:border-box !important;
    }}
    .email-detail-label {{ padding-bottom:4px !important; border-bottom:0 !important; }}
    .email-detail-value {{ padding-top:0 !important; }}
    .email-message-cell {{ padding:18px 16px !important; }}
    .email-message-body {{ font-size:14px !important; line-height:22px !important; }}
    .email-file-cell {{ padding:14px !important; }}
    .email-file-name {{ font-size:14px !important; line-height:20px !important; }}
  }}
</style>
<!--[if mso]>
<style>table,td {{font-family:Arial,sans-serif;}}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:{b['bg']};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
{f'<div style="display:none;max-height:0;overflow:hidden;">{escape(preview_text)}</div>' if preview_text else ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{b['bg']};">
<tr><td align="center" class="email-outer" style="padding:40px 16px;">

<!-- Card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card" style="max-width:680px;background-color:{b['card']};border:1px solid {b['card_border']};border-top:5px solid {b['accent']};border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,0.08);table-layout:fixed;">

<!-- Header -->
<tr>
<td class="email-header email-logo" style="padding:34px 44px 30px;text-align:center;border-bottom:1px solid {b['divider']};">
  {header_html}
</td>
</tr>

<!-- Body -->
<tr>
<td class="email-body" style="padding:42px 46px;">
{content}
</td>
</tr>

<!-- Footer -->
<tr>
<td class="email-footer" style="padding:22px 46px 26px;background-color:{b['footer_bg']};border-top:1px solid {b['divider']};text-align:center;">
  <p style="margin:0;font-size:12px;line-height:18px;color:{b['muted']};">
    &copy; 2026 WorkHive&nbsp;&nbsp;&middot;&nbsp;&nbsp;{footer_text}
  </p>
</td>
</tr>

</table>
<!-- /Card -->

</td></tr>
</table>
</body>
</html>"""


def _button(url: str, label: str) -> str:
    b = _BRAND
    safe_url = escape(url, quote=True)
    safe_label = escape(label)
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">'
        f"<tr><td style=\"background-color:{b['accent']};border-radius:8px;\">"
        f'<a href="{safe_url}" target="_blank" '
        f"style=\"display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;"
        f"color:#ffffff;text-decoration:none;border-radius:8px;\">{safe_label}</a>"
        f"</td></tr></table>"
    )


def _from_address(concept: str | None = None) -> str:
    """Build a From header. If concept is provided, append it to the name."""
    display_name = "WorkHive"
    if concept:
        display_name = f"WorkHive - {concept}"
    return formataddr((display_name, settings.SMTP_FROM_EMAIL))


# ── Send helper ──────────────────────────────────────────────────────────────

def _send_email(message: EmailMessage) -> bool:
    if not settings.smtp_is_configured:
        logger.warning("SMTP is not configured; email was not sent")
        return False

    # Proactively embed the logo as an inline related part
    _add_logo_to_message(message)

    smtp_class = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            smtp.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)
    return True


# ── Public functions ─────────────────────────────────────────────────────────

def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_url: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    safe_reset_url = escape(reset_url, quote=True)

    html_body = _base_layout(
        f"""
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{b['text']};text-align:center;">
  Restablecer contraseña
</h1>
<p style="margin:0 0 24px;font-size:14px;color:{b['muted']};text-align:center;line-height:22px;">
  Hola <strong style="color:{b['text']};">{safe_name}</strong>, hemos recibido una solicitud para restablecer tu contraseña en WorkHive.
</p>

{_button(reset_url, "Restablecer contraseña")}

<!-- Warning Alert Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px;">
<tr>
<td style="background-color:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#b45309;line-height:18px;font-weight:500;">
    ⚠️ Este enlace expira en <strong style="color:#92400e;">15 minutos</strong>.
  </p>
</td>
</tr>
</table>

<p style="margin:0 0 24px;font-size:12px;color:{b['muted']};text-align:center;line-height:18px;">
  Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="border-top:1px solid {b['divider']};padding-top:18px;">
  <p style="margin:0;font-size:11px;color:{b['muted']};line-height:16px;word-break:break-all;text-align:center;">
    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
    <a href="{safe_reset_url}" style="color:{b['accent']};text-decoration:none;">{safe_reset_url}</a>
  </p>
</td></tr>
</table>
""",
        preview_text="Restablece tu contraseña de WorkHive",
    )

    plain_text = "\n".join([
        f"Hola {recipient_name},",
        "",
        "Hemos recibido una solicitud para restablecer tu contraseña.",
        f"Abre este enlace durante los próximos 15 minutos: {reset_url}",
        "",
        "Si no has solicitado este cambio, ignora este mensaje.",
        "",
        "Equipo WorkHive",
    ])

    message = EmailMessage()
    message["Subject"] = "Restablece tu contraseña de WorkHive"
    message["From"] = _from_address("Seguridad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return _send_email(message)


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

    html_body = _base_layout(
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

{_button(f"mailto:{sender_email}", "Responder por correo")}
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
    message["From"] = _from_address("Soporte")
    message["To"] = settings.CONTACT_RECIPIENT_EMAIL
    message["Reply-To"] = sender_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return _send_email(message)


def send_trial_verification_email(
    *,
    recipient_email: str,
    recipient_name: str,
    company_name: str,
    verification_url: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    safe_company = escape(company_name)
    safe_url = escape(verification_url, quote=True)
    html_body = _base_layout(
        f"""
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{b['text']};text-align:center;">
  Verifica tu solicitud
</h1>
<p style="margin:0 0 18px;font-size:14px;color:{b['muted']};text-align:center;line-height:22px;">
  Hola <strong style="color:{b['text']};">{safe_name}</strong>, confirma que este correo pertenece a la persona que solicita acceso para <strong style="color:{b['text']};">{safe_company}</strong>.
</p>
{_button(verification_url, "Verificar solicitud")}
<p style="margin:0;font-size:12px;color:{b['muted']};text-align:center;line-height:18px;">
  Después de verificarlo, un superadmin de WorkHive revisará la solicitud manualmente.
</p>
<p style="margin:18px 0 0;font-size:11px;color:{b['muted']};word-break:break-all;text-align:center;">
  {safe_url}
</p>
""",
        preview_text="Verifica tu solicitud de acceso a WorkHive",
    )
    plain_text = "\n".join([
        f"Hola {recipient_name},",
        "",
        f"Verifica tu solicitud para {company_name}:",
        verification_url,
        "",
        "Después de verificarla, WorkHive revisará tu acceso manualmente.",
    ])
    message = EmailMessage()
    message["Subject"] = "Verifica tu solicitud de acceso a WorkHive"
    message["From"] = _from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return _send_email(message)


def send_trial_approved_email(
    *,
    recipient_email: str,
    recipient_name: str,
    company_name: str,
    setup_url: str,
    access_mode: str,
    trial_ends_at: datetime | None,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    safe_company = escape(company_name)
    safe_url = escape(setup_url, quote=True)
    if access_mode == "trial" and trial_ends_at:
        access_text = f"Tu prueba estará activa hasta el {trial_ends_at.date().isoformat()}."
    else:
        access_text = "Tu acceso Pro ya está activo."

    html_body = _base_layout(
        f"""
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{b['text']};text-align:center;">
  Acceso aprobado
</h1>
<p style="margin:0 0 18px;font-size:14px;color:{b['muted']};text-align:center;line-height:22px;">
  Hola <strong style="color:{b['text']};">{safe_name}</strong>, tu acceso a WorkHive para <strong style="color:{b['text']};">{safe_company}</strong> ha sido aprobado.
</p>
<p style="margin:0 0 18px;font-size:13px;color:{b['muted']};text-align:center;line-height:20px;">
  {escape(access_text)}
</p>
{_button(setup_url, "Crear contraseña")}
<p style="margin:0;font-size:11px;color:{b['muted']};word-break:break-all;text-align:center;">
  {safe_url}
</p>
""",
        preview_text="Tu acceso a WorkHive ha sido aprobado",
    )
    plain_text = "\n".join([
        f"Hola {recipient_name},",
        "",
        f"Tu acceso a WorkHive para {company_name} ha sido aprobado.",
        access_text,
        f"Crea tu contraseña aquí: {setup_url}",
    ])
    message = EmailMessage()
    message["Subject"] = "Tu acceso a WorkHive ha sido aprobado"
    message["From"] = _from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return _send_email(message)


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
        "billing_details": "Billing details" if is_english else "Detalles de facturación",
        "document_number": "Document No." if is_english else "Nº de documento",
        "issuer": "Issuer" if is_english else "Emisor",
        "message": "Message" if is_english else "Mensaje",
        "attachment": "You will find the PDF file attached to this email." if is_english else "Encontrarás el archivo PDF adjunto a este correo.",
        "fallback_body": (
            f"We are attaching {document_label.lower()} {invoice_number} issued by {issuer_name}."
            if is_english
            else f"Adjuntamos {document_label.lower()} {invoice_number} emitida por {issuer_name}."
        ),
        "lead": (
            "Hi <strong style=\"color:{text};\">{recipient}</strong>, we are sending the attached PDF document."
            if is_english
            else "Hola <strong style=\"color:{text};\">{recipient}</strong>, te enviamos el documento adjunto en PDF."
        ),
        "plain_greeting": "Hi" if is_english else "Hola",
        "plain_footer": "This email was sent from WorkHive." if is_english else "Este correo se ha enviado desde WorkHive.",
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

    html_body = _base_layout(
        f"""
<h1 class="email-h1 email-text-break" style="margin:0 0 12px;font-size:30px;line-height:36px;font-weight:800;color:{b['text']};text-align:center;overflow-wrap:anywhere;word-break:break-word;">
  {safe_document_label} {safe_invoice_number}
</h1>
<p class="email-lead email-text-break" style="margin:0 0 30px;font-size:16px;color:{b['muted']};text-align:center;line-height:25px;overflow-wrap:anywhere;word-break:break-word;">
  {copy["lead"].format(text=b["text"], recipient=safe_recipient_name)}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;border:1px solid {b['divider']};border-radius:12px;overflow:hidden;background-color:#ffffff;table-layout:fixed;">
<tr style="background-color:#f9fafb;">
  <td colspan="2" class="email-section-title" style="padding:14px 20px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:{b['muted']};border-bottom:1px solid {b['divider']};">
    {copy["billing_details"]}
  </td>
</tr>
<tr>
  <td class="email-detail-label" style="padding:16px 20px;font-size:14px;font-weight:700;color:{b['muted']};width:150px;vertical-align:top;border-bottom:1px solid {b['divider']};">{copy["document_number"]}:</td>
  <td class="email-detail-value email-text-break" style="padding:16px 20px;font-size:16px;color:{b['text']};border-bottom:1px solid {b['divider']};font-weight:800;overflow-wrap:anywhere;word-break:break-word;">{safe_invoice_number}</td>
</tr>
<tr>
  <td class="email-detail-label" style="padding:16px 20px;font-size:14px;font-weight:700;color:{b['muted']};width:150px;vertical-align:top;">{copy["issuer"]}:</td>
  <td class="email-detail-value email-text-break" style="padding:16px 20px;font-size:16px;color:{b['text']};font-weight:700;overflow-wrap:anywhere;word-break:break-word;">{safe_issuer_name}</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;border:1px solid {b['accent_border']};border-radius:12px;background-color:{b['accent_soft']};table-layout:fixed;">
<tr>
<td class="email-message-cell" style="padding:24px 26px;text-align:left;">
  <p style="margin:0 0 14px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:{b['accent']};">{copy["message"]}:</p>
  <p class="email-message-body email-text-break" style="margin:0;font-size:16px;color:{b['text']};line-height:26px;overflow-wrap:anywhere;word-break:break-word;">{safe_body_html}</p>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:1px solid {b['divider']};border-radius:12px;background-color:#ffffff;table-layout:fixed;">
<tr>
<td class="email-file-cell" style="padding:18px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="56" style="vertical-align:top;">
      <span style="display:inline-block;width:46px;height:46px;border-radius:12px;background-color:#fee2e2;color:#dc2626;font-size:11px;line-height:46px;text-align:center;font-weight:900;">PDF</span>
    </td>
    <td style="vertical-align:middle;">
      <p class="email-file-name email-text-break" style="margin:0 0 4px;font-size:15px;font-weight:800;color:{b['text']};overflow-wrap:anywhere;word-break:break-word;">{safe_invoice_number}.pdf</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:{b['muted']};">
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

    plain_text = "\n".join([
        f"{copy['plain_greeting']} {recipient_name},",
        "",
        body_text,
        "",
        copy["plain_footer"],
    ])

    message = EmailMessage()
    message["Subject"] = subject or f"{document_label_text} {invoice_number} - {issuer_name}"
    message["From"] = _from_address(copy["from_concept"])
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
    return _send_email(message)
