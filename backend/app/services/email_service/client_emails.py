from email.message import EmailMessage
from email.utils import formataddr
from html import escape

from app.services.email_service import transport


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
    plain_body = f"Hello {recipient_name},\n\n{content}".strip()
    html_body = (
        f"<p>Hello {escape(recipient_name)},</p>"
        f"<p>{escape(content).replace(chr(10), '<br>')}</p>"
    )
    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")
    return transport.send_email(message)
