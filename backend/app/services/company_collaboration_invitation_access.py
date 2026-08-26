import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.user import User
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret
from app.services.company_collaboration_invitation_tokens import normalize_verification_code


PENDING_STATUS = "pending"
EXPIRED_STATUS = "expired"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_active_company(db: Session, company_id: int | None) -> Company:
    if company_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required for collaboration invitations",
        )
    company = db.get(Company, company_id)
    if not company or not company.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your company is inactive or unavailable",
        )
    return company


def is_expired(invitation: CompanyCollaborationInvitation) -> bool:
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= utcnow()


def find_pending_invitation(
    db: Session,
    *,
    inviter_company_id: int,
    email: str,
) -> CompanyCollaborationInvitation | None:
    return (
        db.query(CompanyCollaborationInvitation)
        .filter(
            CompanyCollaborationInvitation.inviter_company_id == inviter_company_id,
            CompanyCollaborationInvitation.email == email,
            CompanyCollaborationInvitation.status == PENDING_STATUS,
        )
        .order_by(CompanyCollaborationInvitation.updated_at.desc())
        .first()
    )


def find_pending_invitation_by_token(
    db: Session,
    token: str,
) -> CompanyCollaborationInvitation:
    invitation = (
        db.query(CompanyCollaborationInvitation)
        .filter(CompanyCollaborationInvitation.token_hash == hash_invitation_secret(token))
        .first()
    )
    if not invitation or invitation.status != PENDING_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation is invalid or has already been used",
        )
    if is_expired(invitation):
        invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Ask the sender to send a new one.",
        )
    return invitation


def require_valid_verification_code(
    invitation: CompanyCollaborationInvitation,
    verification_code: str,
) -> None:
    expected_code_hash = invitation.verification_code_hash
    if not expected_code_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invitation must be resent to use the verification code.",
        )
    provided_code_hash = hash_invitation_secret(
        normalize_verification_code(verification_code)
    )
    if not secrets.compare_digest(expected_code_hash, provided_code_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is incorrect. Check the invitation email and try again.",
        )


def require_invitation_account(
    db: Session,
    invitation: CompanyCollaborationInvitation,
    current_user: User,
) -> tuple[Company, Company]:
    if current_user.email.strip().lower() != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in with the email that received this invitation",
        )

    accepting_company = require_active_company(db, current_user.company_id)
    if accepting_company.id == invitation.inviter_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot accept a collaboration invitation for your own company",
        )
    inviter_company = require_active_company(db, invitation.inviter_company_id)
    return inviter_company, accepting_company
