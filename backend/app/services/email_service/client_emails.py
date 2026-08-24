from email.message import EmailMessage
from html import escape

from app.services.email_service import transport
from app.services.email_service.layout import base_layout, heading, lead, plain_body


def send_client_email(
    *,
    recipient_emails: list[str],
    recipient_name: str,
    subject: str | None,
    custom_message: str | None,
    reply_to_email: str | None,
    copy_emails: list[str] | None = None,
    sender_copy_email: str | None = None,
) -> bool:
    message = EmailMessage()
    message["Subject"] = subject or "WorkHive"
    message["From"] = transport.from_address("Client message")
    message["To"] = ", ".join(recipient_emails)
    if copy_emails:
        message["Cc"] = ", ".join(copy_emails)
    if sender_copy_email:
        message["Bcc"] = sender_copy_email
    if reply_to_email:
        message["Reply-To"] = reply_to_email

    content = custom_message or ""
    safe_name = escape(recipient_name)
    safe_content = escape(content).replace("\n", "<br>")
    html_body = base_layout(
        f"""
{heading("Message from WorkHive")}
{lead(f"Hello {safe_name},")}
<p style="margin:0;font-size:14px;line-height:22px;color:#111827;">{safe_content}</p>
""",
        preview_text=content[:140],
        locale="en",
    )
    plain_text = plain_body([f"Hello {recipient_name},", "", content])
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
