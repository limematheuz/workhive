from datetime import datetime
from email.message import EmailMessage
from html import escape

from app.services.email_service import transport
from app.services.email_service.layout import (
    _BRAND,
    accent_box,
    base_layout,
    heading,
    lead,
    muted_note,
)


def send_erasure_request_received_email(
    *,
    recipient_email: str,
    recipient_name: str,
    response_due_at: datetime,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name) or ""
    due_date = response_due_at.date().isoformat()
    greeting = (
        f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>,'
        if safe_name
        else "Hola,"
    )
    html_body = base_layout(
        f"""
{heading("Hemos recibido tu solicitud de supresión")}
{lead(f"{greeting} hemos registrado tu solicitud de supresión de datos y cuenta.")}
{muted_note(f"Este correo es un acuse de recibo, no una decisión sobre la solicitud. Te informaremos del resultado como máximo el {escape(due_date)}.")}
{accent_box(f'<p style="margin:0;font-size:12px;line-height:18px;color:{b["text"]};">Si se aprueba, tu cuenta quedará sin acceso y tus datos personales se anonimizarán o suprimirán sin demora, salvo los datos que debamos conservar por una obligación legal.</p>')}
{muted_note("No respondas a este correo si no reconoces la solicitud; contacta con el responsable del tratamiento por los canales de privacidad de WorkHive.")}
""",
        preview_text="Hemos recibido tu solicitud de supresión de datos",
    )
    plain_text = "\n".join([
        f"Hola {recipient_name}," if recipient_name else "Hola,",
        "",
        "Hemos registrado tu solicitud de supresión de datos y cuenta.",
        "Este correo es un acuse de recibo, no una decisión sobre la solicitud.",
        f"Te informaremos del resultado como máximo el {due_date}.",
        "Si se aprueba, tu cuenta quedará sin acceso y tus datos personales se anonimizarán o suprimirán sin demora, salvo los datos que debamos conservar por una obligación legal.",
    ])
    message = EmailMessage()
    message["Subject"] = "Hemos recibido tu solicitud de supresión - WorkHive"
    message["From"] = transport.from_address("Privacidad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)


def send_erasure_request_resolved_email(
    *,
    recipient_email: str,
    recipient_name: str,
    approved: bool,
    resolution_notes: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name) or ""
    safe_notes = escape(resolution_notes).replace("\n", "<br>")
    greeting = (
        f'Hola <strong style="color:{b["text"]};">{safe_name}</strong>,'
        if safe_name
        else "Hola,"
    )
    if approved:
        title = "Tu solicitud de supresión ha sido atendida"
        result = (
            "Tu cuenta ya no tiene acceso. Tus datos personales se han anonimizado o "
            "suprimido sin demora, salvo la información que debamos conservar por una "
            "obligación legal."
        )
    else:
        title = "Hemos resuelto tu solicitud de supresión"
        result = (
            "No hemos podido atender total o parcialmente tu solicitud. "
            "A continuación te explicamos el motivo."
        )
    html_body = base_layout(
        f"""
{heading(title)}
{lead(f"{greeting} {escape(result)}")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid {b['divider']};border-radius:10px;background-color:{b['card']};overflow:hidden;">
<tr><td style="padding:14px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:{b['muted']};border-bottom:1px solid {b['divider']};background-color:{b['inset_bg']};">Mensaje del administrador</td></tr>
<tr><td style="padding:16px;font-size:14px;line-height:22px;color:{b['text']};">{safe_notes}</td></tr>
</table>
{muted_note("Si no estás conforme con esta respuesta, puedes ejercer tus derechos ante el responsable del tratamiento o reclamar ante la autoridad de protección de datos competente.")}
""",
        preview_text=title,
    )
    plain_text = "\n".join([
        f"Hola {recipient_name}," if recipient_name else "Hola,",
        "",
        title,
        result,
        "",
        "Mensaje del administrador:",
        resolution_notes,
        "",
        "Si no estás conforme con esta respuesta, puedes ejercer tus derechos ante el responsable del tratamiento o reclamar ante la autoridad de protección de datos competente.",
    ])
    message = EmailMessage()
    message["Subject"] = f"{title} - WorkHive"
    message["From"] = transport.from_address("Privacidad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
