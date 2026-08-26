import secrets
import smtplib
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.user import User
from app.repositories import user as user_repo
from app.schemas.collaboration import (
    CompanyCollaborationInvitationAccept,
    CompanyCollaborationInvitationAccessCheck,
    CompanyCollaborationInvitationCreate,
)
from app.services import email_service
from app.services.company_collaboration_invitation_access import (
    EXPIRED_STATUS,
    PENDING_STATUS,
    find_pending_invitation,
    find_pending_invitation_by_token,
    is_expired,
    require_active_company,
    require_invitation_account,
    require_valid_verification_code,
    utcnow,
)
from app.services.company_collaboration_invitation_decision import accept_for_company
from app.services.company_collaboration_invitation_notifications import (
    notify_decision,
    send_decision_emails,
)
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret, new_verification_code

REVOKED_STATUS = "revoked"
DECLINED_STATUS = "declined"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _require_authorized_invitation(
    db: Session,
    payload: CompanyCollaborationInvitationAccept,
    current_user: User,
) -> tuple[CompanyCollaborationInvitation, Company, Company]:
    invitation = find_pending_invitation_by_token(db, payload.token)
    inviter_company, accepting_company = require_invitation_account(
        db,
        invitation,
        current_user,
    )
    require_valid_verification_code(invitation, payload.verification_code)
    return invitation, inviter_company, accepting_company


def verify_invitation_access(
    db: Session,
    payload: CompanyCollaborationInvitationAccessCheck,
    current_user: User,
) -> None:
    """Confirm the signed-in company administrator before requesting the code."""

    invitation = find_pending_invitation_by_token(db, payload.token)
    require_invitation_account(db, invitation, current_user)


def verify_invitation_code(
    db: Session,
    payload: CompanyCollaborationInvitationAccept,
) -> str:
    """Verify the email code before collecting an invited company's details."""

    invitation = find_pending_invitation_by_token(db, payload.token)
    require_valid_verification_code(invitation, payload.verification_code)
    return invitation.email


def create_invitation(
    db: Session,
    payload: CompanyCollaborationInvitationCreate,
    inviter: User,
) -> CompanyCollaborationInvitation:
    if not settings.smtp_is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is not configured",
        )

    inviter_company = require_active_company(db, inviter.company_id)
    email = _normalize_email(str(payload.email))
    if email == _normalize_email(inviter.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite your own company",
        )

    existing_recipient = user_repo.get_user_by_email(db, email)
    if (
        existing_recipient
        and existing_recipient.role
        and existing_recipient.role.name not in {"admin", "viewer"}
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This email belongs to an internal team member. Use that company's "
                "administrator email for a company collaboration invitation."
            ),
        )

    existing = find_pending_invitation(
        db,
        inviter_company_id=inviter_company.id,
        email=email,
    )
    if existing:
        if is_expired(existing):
            existing.status = EXPIRED_STATUS
            db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This company already has a pending invitation. Revoke it before "
                    "sending another invitation or changing the relationship."
                ),
            )

    token = secrets.token_urlsafe(32)
    verification_code = new_verification_code(db)
    expires_at = utcnow() + timedelta(hours=settings.WORKER_INVITATION_EXPIRE_HOURS)
    invitation = CompanyCollaborationInvitation(
        inviter_company_id=inviter_company.id,
        invited_by_user_id=inviter.id,
        email=email,
        role_type=payload.role_type,
        token_hash=hash_invitation_secret(token),
        verification_code_hash=hash_invitation_secret(verification_code),
        status=PENDING_STATUS,
        expires_at=expires_at,
    )
    db.add(invitation)

    invitation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/accept-company-invitation#token={token}"
    )
    try:
        sent = email_service.send_company_collaboration_invitation_email(
            recipient_email=email,
            inviter_company_name=inviter_company.name,
            invitation_url=invitation_url,
            verification_code=verification_code,
            expires_at=expires_at,
            role_type=payload.role_type,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        # Email delivery is part of the invitation contract; do not persist a link we did not send.
        sent = False
    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is temporarily unavailable",
        )

    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(
    db: Session,
    payload: CompanyCollaborationInvitationAccept,
    current_user: User,
) -> CompanyCollaboration:
    invitation, inviter_company, accepting_company = _require_authorized_invitation(
        db,
        payload,
        current_user,
    )

    return accept_for_company(
        db,
        invitation=invitation,
        accepting_company=accepting_company,
        accepting_user=current_user,
    )


def decline_invitation(
    db: Session,
    payload: CompanyCollaborationInvitationAccept,
    current_user: User,
) -> CompanyCollaborationInvitation:
    invitation, inviter_company, accepting_company = _require_authorized_invitation(
        db,
        payload,
        current_user,
    )
    invitation.status = DECLINED_STATUS
    invitation.accepted_at = utcnow()
    invitation.accepted_company_id = accepting_company.id
    db.commit()
    db.refresh(invitation)
    notify_decision(
        db,
        invitation=invitation,
        users=[current_user],
        counterpart_company_name=inviter_company.name,
        decision=DECLINED_STATUS,
    )
    if invitation.invited_by:
        notify_decision(
            db,
            invitation=invitation,
            users=[invitation.invited_by],
            counterpart_company_name=accepting_company.name,
            decision=DECLINED_STATUS,
        )
    send_decision_emails(invitation, inviter_company, accepting_company, DECLINED_STATUS)
    return invitation


def list_sent_invitations(
    db: Session,
    inviter: User,
) -> list[CompanyCollaborationInvitation]:
    require_active_company(db, inviter.company_id)
    return (
        db.query(CompanyCollaborationInvitation)
        .filter(CompanyCollaborationInvitation.inviter_company_id == inviter.company_id)
        .order_by(CompanyCollaborationInvitation.created_at.desc())
        .all()
    )


def revoke_invitation(
    db: Session,
    invitation_id: int,
    inviter: User,
) -> CompanyCollaborationInvitation:
    require_active_company(db, inviter.company_id)
    invitation = (
        db.query(CompanyCollaborationInvitation)
        .filter(
            CompanyCollaborationInvitation.id == invitation_id,
            CompanyCollaborationInvitation.inviter_company_id == inviter.company_id,
        )
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.status != PENDING_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be revoked",
        )
    invitation.status = REVOKED_STATUS
    db.commit()
    db.refresh(invitation)
    notify_decision(
        db,
        invitation=invitation,
        users=[inviter],
        counterpart_company_name=invitation.email,
        decision=REVOKED_STATUS,
    )
    send_decision_emails(invitation, invitation.inviter_company, None, REVOKED_STATUS)
    return invitation
