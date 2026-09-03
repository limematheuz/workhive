from datetime import datetime
from email.message import EmailMessage
from html import escape

from app.services.email_service import transport
from app.services.email_service.layout import (
    _BRAND,
    base_layout,
    button,
    fallback_link,
    heading,
    lead,
    muted_note,
    plain_body,
)


def _invitation_copy(role_name: str) -> tuple[str, str, str]:
    if role_name == "external_portal":
        return (
            "Te han invitado como gestoría externa",
            "Tendrás acceso limitado y de solo lectura al área financiera de la empresa.",
            "Crear mi acceso de gestor",
        )
    return (
        "Te han invitado a WorkHive",
        "Formarás parte del equipo de la empresa en WorkHive.",
        "Crear mi acceso",
    )


def send_worker_invitation_email(
    *,
    recipient_email: str,
    recipient_name: str,
    company_name: str,
    invitation_url: str,
    verification_code: str,
    expires_at: datetime,
    role_name: str,
) -> bool:
    """Send the personnel invitation and describe the invited person's access."""

    b = _BRAND
    safe_name = escape(recipient_name) or ""
    safe_company = escape(company_name)
    safe_code = escape(verification_code)
    title, access_description, action_label = _invitation_copy(role_name)
    expires_text = expires_at.astimezone().strftime("%d/%m/%Y %H:%M")
    greeting = (
        f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>,'
        if safe_name
        else "Hola,"
    )
    html_body = base_layout(
        f"""
{heading(title)}
{lead(f'{greeting} te han invitado a unirte a <strong style="color:{b["text"]};">{safe_company}</strong>.')}
{muted_note(access_description)}
{muted_note("Abre el enlace y usa este código de verificación:")}
<p style="margin:12px 0 8px;font-size:30px;font-weight:800;letter-spacing:6px;color:{b["text"]};text-align:center;">
  {safe_code}
</p>
{button(invitation_url, action_label)}
{muted_note(f"La invitación caduca el {escape(expires_text)}. No compartas el código con nadie.")}
{fallback_link(invitation_url)}
""",
        preview_text=f"Invitación para unirte a {company_name} en WorkHive",
    )
    plain_text = plain_body(
        [
            f"Hola {recipient_name}," if recipient_name else "Hola,",
            "",
            f"Te han invitado a unirte a {company_name} en WorkHive.",
            access_description,
            f"Código de verificación: {verification_code}",
            f"Crea tu acceso aquí: {invitation_url}",
            f"La invitación caduca el {expires_text}.",
            "",
            "No compartas este código con nadie.",
        ]
    )
    message = EmailMessage()
    message["Subject"] = f"{title}: {company_name}"
    message["From"] = transport.from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
