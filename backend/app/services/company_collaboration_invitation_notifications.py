import logging
import smtplib

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.user import User
from app.services import email_service, notification_service

logger = logging.getLogger(__name__)


def send_decision_emails(
    invitation: CompanyCollaborationInvitation,
    inviter_company: Company,
    accepting_company: Company | None,
    decision: str,
) -> None:
    inviter_email = invitation.invited_by.email if invitation.invited_by else inviter_company.email
    invited_company_label = invitation.email
    recipients = {
        (invitation.email, inviter_company.name),
        (inviter_email.strip().lower(), accepting_company.name if accepting_company else invited_company_label),
    }
    for recipient_email, counterpart_name in recipients:
        try:
            email_service.send_company_collaboration_decision_email(
                recipient_email=recipient_email,
                counterpart_company_name=counterpart_name,
                decision=decision,
            )
        except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException) as error:
            logger.warning("Company collaboration decision delivery failed (%s)", type(error).__name__)


def notify_decision(
    db: Session,
    *,
    invitation: CompanyCollaborationInvitation,
    users: list[User],
    counterpart_company_name: str,
    decision: str,
) -> None:
    status_label = {
        "accepted": "aceptada",
        "declined": "rechazada",
        "revoked": "revocada",
    }[decision]
    notification_service.notify_users(
        db,
        users=users,
        event_type=f"company_collaboration.invitation_{decision}",
        title=f"Colaboración {status_label}",
        message=f"La colaboración con {counterpart_company_name} ha sido {status_label}.",
        entity_type="company_collaboration_invitation",
        entity_id=invitation.id,
        href="/dashboard/users?tab=companies",
        metadata={"decision": decision},
        commit=True,
    )
