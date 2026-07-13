import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings
from app.services.email_service.layout import add_logo_to_message

logger = logging.getLogger(__name__)


def from_address(concept: str | None = None) -> str:
    """Build a From header. If concept is provided, append it to the name."""
    display_name = "WorkHive"
    if concept:
        display_name = f"WorkHive - {concept}"
    return formataddr((display_name, settings.SMTP_FROM_EMAIL))


def send_email(message: EmailMessage) -> bool:
    if not settings.smtp_is_configured:
        logger.warning("SMTP is not configured; email was not sent")
        return False

    add_logo_to_message(message)

    smtp_class = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            smtp.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)
    return True
