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
    support_link,
    warning_box,
)


def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_url: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    html_body = base_layout(
        f"""
{heading("Restablecer contraseña")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, hemos recibido una solicitud para restablecer tu contraseña en WorkHive.')}
{button(reset_url, "Restablecer contraseña")}
{warning_box(f'⚠️ Este enlace expira en <strong style="color:{b["warning_strong"]};">15 minutos</strong>.')}
{muted_note("Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.")}
{fallback_link(reset_url)}
""",
        preview_text="Restablece tu contraseña de WorkHive",
    )

    plain_text = plain_body(
        [
            f"Hola {recipient_name},",
            "",
            "Hemos recibido una solicitud para restablecer tu contraseña.",
            f"Abre este enlace durante los próximos 15 minutos: {reset_url}",
            "",
            "Si no has solicitado este cambio, ignora este mensaje.",
            "",
            "Equipo WorkHive",
        ]
    )

    message = EmailMessage()
    message["Subject"] = "Restablece tu contraseña de WorkHive"
    message["From"] = transport.from_address("Seguridad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_email_change_verification_email(
    *,
    recipient_email: str,
    recipient_name: str,
    confirmation_url: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    html_body = base_layout(
        f"""
{heading("Confirma tu nuevo correo")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, confirma esta dirección para usarla como acceso a WorkHive.')}
{button(confirmation_url, "Confirmar nuevo correo")}
{muted_note("El enlace caduca en 15 minutos. Si no solicitaste el cambio, ignora este mensaje.")}
{fallback_link(confirmation_url)}
""",
        preview_text="Confirma tu nuevo correo de acceso a WorkHive",
    )
    plain_text = plain_body(
        [
            f"Hola {recipient_name},",
            "",
            "Confirma esta dirección para usarla como acceso a WorkHive:",
            confirmation_url,
            "",
            "El enlace caduca en 15 minutos.",
            "Si no solicitaste este cambio, ignora este mensaje.",
        ]
    )
    message = EmailMessage()
    message["Subject"] = "Confirma tu nuevo correo de WorkHive"
    message["From"] = transport.from_address("Seguridad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_email_changed_notice(
    *,
    recipient_email: str,
    recipient_name: str,
    new_email: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    safe_new_email = escape(new_email)
    html_body = base_layout(
        f"""
{heading("Correo de acceso actualizado")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, tu correo de acceso a WorkHive ahora es <strong style="color:{b["text"]};">{safe_new_email}</strong>.')}
{muted_note(f"Todas las sesiones anteriores se han cerrado. Si no realizaste este cambio, {support_link("contacta con soporte")}.")}
""",
        preview_text="Tu correo de acceso a WorkHive ha cambiado",
    )
    plain_text = plain_body(
        [
            f"Hola {recipient_name},",
            "",
            f"Tu correo de acceso a WorkHive ahora es {new_email}.",
            "Todas las sesiones anteriores se han cerrado.",
            "Si no realizaste este cambio, contacta con soporte.",
        ]
    )
    message = EmailMessage()
    message["Subject"] = "Tu correo de acceso a WorkHive ha cambiado"
    message["From"] = transport.from_address("Seguridad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_paid_company_activation_email(
    *,
    recipient_email: str,
    recipient_name: str,
    company_name: str,
    plan_name: str,
    activation_url: str,
) -> bool:
    """Send the one-time link that creates a paid customer's tenant."""

    b = _BRAND
    safe_name = escape(recipient_name)
    safe_company_name = escape(company_name)
    safe_plan_name = escape(plan_name)
    html_body = base_layout(
        f"""
{heading("Tu empresa está lista para activarse")}
{lead(f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>, hemos confirmado el pago de <strong style="color:{b["text"]};">{safe_plan_name}</strong> para <strong style="color:{b["text"]};">{safe_company_name}</strong>.')}
{button(activation_url, "Crear acceso seguro")}
{muted_note("Este enlace es personal y caduca en 7 días. Al continuar elegirás la contraseña de la cuenta administradora.")}
{fallback_link(activation_url)}
""",
        preview_text="Activa tu empresa en WorkHive",
    )
    plain_text = plain_body(
        [
            f"Hola {recipient_name},",
            "",
            f"Hemos confirmado el pago de {plan_name} para {company_name}.",
            "Crea el acceso seguro de la cuenta administradora aquí:",
            activation_url,
            "",
            "Este enlace es personal y caduca en 7 días.",
        ]
    )
    message = EmailMessage()
    message["Subject"] = "Activa tu empresa en WorkHive"
    message["From"] = transport.from_address("Acceso")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
