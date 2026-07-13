from email.message import EmailMessage
from html import escape

from app.services.email_service import transport
from app.services.email_service.layout import _BRAND, base_layout, button


def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_url: str,
) -> bool:
    b = _BRAND
    safe_name = escape(recipient_name)
    safe_reset_url = escape(reset_url, quote=True)

    html_body = base_layout(
        f"""
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{b['text']};text-align:center;">
  Restablecer contraseña
</h1>
<p style="margin:0 0 24px;font-size:14px;color:{b['muted']};text-align:center;line-height:22px;">
  Hola <strong style="color:{b['text']};">{safe_name}</strong>, hemos recibido una solicitud para restablecer tu contraseña en WorkHive.
</p>

{button(reset_url, "Restablecer contraseña")}

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
    message["From"] = transport.from_address("Seguridad")
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
