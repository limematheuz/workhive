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
)


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
    html_body = base_layout(
        f"""
{heading("Verifica tu solicitud")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, confirma que este correo pertenece a la persona que solicita acceso para <strong style="color:{b["text"]};">{safe_company}</strong>.')}
{button(verification_url, "Verificar solicitud")}
{muted_note("Después de verificarlo, un superadmin de WorkHive revisará la solicitud manualmente.")}
{fallback_link(verification_url)}
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
    message["From"] = transport.from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


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
    if access_mode == "trial" and trial_ends_at:
        access_text = f"Tu prueba estará activa hasta el {trial_ends_at.date().isoformat()}."
    else:
        access_text = "Tu acceso Pro ya está activo."

    html_body = base_layout(
        f"""
{heading("Acceso aprobado")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, tu acceso a WorkHive para <strong style="color:{b["text"]};">{safe_company}</strong> ha sido aprobado.')}
{muted_note(escape(access_text))}
{button(setup_url, "Crear contraseña")}
{fallback_link(setup_url)}
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
    message["From"] = transport.from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_worker_invitation_email(
    *,
    recipient_email: str,
    recipient_name: str,
    company_name: str,
    invitation_url: str,
    verification_code: str,
    expires_at: datetime,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name) or ""
    safe_company = escape(company_name)
    safe_code = escape(verification_code)
    expires_text = expires_at.astimezone().strftime("%d/%m/%Y %H:%M")
    greeting = (
        f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>,'
        if safe_name
        else "Hola,"
    )
    html_body = base_layout(
        f"""
{heading("Te han invitado a WorkHive")}
{lead(f'{greeting} te han invitado a unirte al equipo de <strong style="color:{b["text"]};">{safe_company}</strong>.')}
{muted_note("Abre el enlace y usa este código de verificación:")}
<p style="margin:12px 0 8px;font-size:30px;font-weight:800;letter-spacing:6px;color:{b['text']};text-align:center;">
  {safe_code}
</p>
{button(invitation_url, "Crear mi acceso")}
{muted_note(f"La invitación caduca el {escape(expires_text)}. No compartas el código con nadie.")}
{fallback_link(invitation_url)}
""",
        preview_text=f"Invitación para unirte a {company_name} en WorkHive",
    )
    plain_text = "\n".join([
        f"Hola {recipient_name}," if recipient_name else "Hola,",
        "",
        f"Te han invitado a unirte al equipo de {company_name} en WorkHive.",
        f"Código de verificación: {verification_code}",
        f"Crea tu acceso aquí: {invitation_url}",
        f"La invitación caduca el {expires_text}.",
        "",
        "No compartas este código con nadie.",
    ])
    message = EmailMessage()
    message["Subject"] = f"Invitación para unirte a {company_name} en WorkHive"
    message["From"] = transport.from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
