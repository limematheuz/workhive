import logging
import smtplib

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.rate_limit import rate_limit_key, rate_limiter
from app.schemas.contact import ContactRequest
from app.services import email_service


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", status_code=status.HTTP_202_ACCEPTED)
def submit_contact_message(contact: ContactRequest, request: Request) -> dict[str, str]:
    if not settings.CONTACT_FORM_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contact form is not configured",
        )

    rate_limiter.enforce(
        rate_limit_key(request, "contact", contact.email),
        settings.CONTACT_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )

    if contact.website:
        return {"status": "accepted"}

    try:
        sent = email_service.send_contact_email(
            sender_name=contact.name,
            sender_email=contact.email,
            subject=contact.subject,
            body=contact.message,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        logger.exception("Contact email delivery failed")
        sent = False

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contact delivery is temporarily unavailable",
        )
    return {"status": "accepted"}
