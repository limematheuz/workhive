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


def _relationship_copy(role_type: str) -> tuple[str, str, str]:
    if role_type == "property_manager":
        return (
            "Invitación para solicitar servicios",
            "Tu empresa se conectará como inmobiliaria o gestora de propiedades para solicitar servicios.",
            "solicitar servicios",
        )
    return (
        "Invitación para prestar servicios",
        "Tu empresa se conectará como proveedor de servicios de la empresa invitante.",
        "prestar servicios",
    )


def send_company_collaboration_invitation_email(
    *,
    recipient_email: str,
    inviter_company_name: str,
    invitation_url: str,
    verification_code: str,
    expires_at: datetime,
    role_type: str,
) -> bool:
    """Send a company collaboration invitation with its precise relationship."""

    b = _BRAND
    safe_company = escape(inviter_company_name)
    safe_code = escape(verification_code)
    invitation_title, relationship_description, action = _relationship_copy(role_type)
    expires_text = expires_at.astimezone().strftime("%d/%m/%Y %H:%M")
    html_body = base_layout(
        f"""
{heading(invitation_title)}
{lead(f'<strong style="color:{b["text"]};">{safe_company}</strong> quiere conectar su empresa con la tuya en WorkHive para {action}.')}
{muted_note(relationship_description)}
{muted_note("Abre el enlace y usa este código de verificación. Si la empresa aún no tiene cuenta, podrás crearla allí mismo; si ya la tiene, inicia sesión con la cuenta administradora invitada.")}
<p style="margin:12px 0 8px;font-size:30px;font-weight:800;letter-spacing:6px;color:{b["text"]};text-align:center;">{safe_code}</p>
{button(invitation_url, "Revisar invitación")}
{muted_note(f"La invitación caduca el {escape(expires_text)}. Al aceptar o rechazar, las dos empresas recibirán una confirmación por correo.")}
{fallback_link(invitation_url)}
""",
        preview_text=f"{inviter_company_name} quiere conectar con tu empresa en WorkHive",
    )
    message = EmailMessage()
    message["Subject"] = f"{invitation_title}: {inviter_company_name}"
    message["From"] = transport.from_address("Colaboraciones")
    message["To"] = recipient_email
    message.set_content(
        plain_body(
            [
                f"{invitation_title} en WorkHive.",
                "",
                f"{inviter_company_name} quiere conectar su empresa con la tuya para {action}.",
                relationship_description,
                f"Código de verificación: {verification_code}",
                f"Revisa la invitación: {invitation_url}",
                "Si tu empresa aún no usa WorkHive, podrás crear su cuenta directamente desde el enlace. Si ya tiene cuenta, inicia sesión con el mismo correo en una cuenta administradora.",
                f"La invitación caduca el {expires_text}.",
            ]
        )
    )
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_company_collaboration_decision_email(
    *,
    recipient_email: str,
    counterpart_company_name: str,
    decision: str,
) -> bool:
    safe_company = escape(counterpart_company_name)
    decision_copy = {
        "accepted": ("aceptada", "Ya podéis trabajar con las ubicaciones y servicios compartidos en WorkHive."),
        "declined": ("rechazada", "No se han compartido datos ni accesos entre las empresas."),
        "revoked": ("revocada", "No se han compartido datos ni accesos entre las empresas."),
    }
    decision_label, next_step = decision_copy[decision]
    html_body = base_layout(
        f"""
{heading(f"Colaboración {decision_label}")}
{lead(f'La colaboración con <strong>{safe_company}</strong> ha sido {decision_label}.')}
{muted_note(next_step)}
""",
        preview_text=f"Colaboración {decision_label} con {counterpart_company_name}",
    )
    message = EmailMessage()
    message["Subject"] = f"[WorkHive] Colaboración {decision_label}: {counterpart_company_name}"
    message["From"] = transport.from_address("Colaboraciones")
    message["To"] = recipient_email
    message.set_content(
        plain_body(
            [
                f"La colaboración con {counterpart_company_name} ha sido {decision_label}.",
                "",
                next_step,
            ]
        )
    )
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
