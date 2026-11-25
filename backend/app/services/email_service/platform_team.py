from email.message import EmailMessage
from smtplib import SMTPException

from app.core.config import settings
from app.services.email_service import transport
from app.services.email_service.layout import base_layout, button, fallback_link, heading, lead, muted_note, plain_body, warning_box


def notify_invitee(email: str, url: str) -> bool:
    if not settings.EMAIL_ENABLED or not settings.smtp_is_configured:
        return False
    message = EmailMessage()
    message["From"] = transport.from_address("Equipo técnico")
    message["To"] = email
    message["Subject"] = "Invitación al equipo de plataforma de WorkHive"
    introduction = "Te han invitado al equipo técnico de WorkHive con permisos de superadmin. Crea tu contraseña para activar la cuenta."
    expiry = "El enlace es de un solo uso y caduca en 24 horas."
    note = "Si no esperabas esta invitación, puedes ignorarla."
    message.set_content(plain_body([introduction, "", f"Activar mi cuenta: {url}", "", expiry, note]))
    message.add_alternative(base_layout(
        "".join([
            heading("Activa tu cuenta de equipo técnico"),
            lead(introduction),
            button(url, "Activar mi cuenta"),
            warning_box(expiry),
            muted_note(note),
            fallback_link(url),
        ]),
        preview_text="Crea tu contraseña para activar tu acceso al equipo técnico de WorkHive.",
    ), subtype="html")
    try:
        return transport.send_email(message)
    except (SMTPException, OSError):
        return False
