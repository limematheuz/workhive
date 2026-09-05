"""Validation and entitlement policy for sponsored partner invitations."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.sponsored_partner_invitation import SponsoredPartnerInvitation
from app.repositories import sponsored_partner_invitation as invitation_repo
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret
from app.services.entitlement_service import require_company_feature
from app.services.partner_portal_policy import PARTNER_PORTAL_FEATURE_CODE
from app.services.subscription_policy import require_company_access

PENDING_STATUS = "pending"
ACCEPTED_STATUS = "accepted"
REVOKED_STATUS = "revoked"
EXPIRED_STATUS = "expired"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_expired(invitation: SponsoredPartnerInvitation) -> bool:
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= utcnow()


def require_pending_invitation(db: Session, *, token: str) -> SponsoredPartnerInvitation:
    invitation = invitation_repo.find_by_token_hash(db, token_hash=hash_invitation_secret(token))
    if invitation is None or invitation.status != PENDING_STATUS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This sponsored portal invitation is no longer available")
    if is_expired(invitation):
        invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This sponsored portal invitation has expired")
    return invitation


def require_host_portal_entitlement(db: Session, host_company: Company) -> None:
    require_company_access(host_company)
    require_company_feature(db, company_id=host_company.id, code=PARTNER_PORTAL_FEATURE_CODE)
