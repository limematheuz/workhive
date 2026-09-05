from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.services.subscription_policy import require_company_access
from app.services.organization_authorization_service import require_capability


PENDING_STATUS = "pending"
EXPIRED_STATUS = "expired"
CANCELED_STATUS = "canceled"


def expire_if_needed(invitation: UserInvitation) -> bool:
    if invitation.status != PENDING_STATUS:
        return False
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at > datetime.now(timezone.utc):
        return False
    invitation.status = EXPIRED_STATUS
    return True


def list_company_invitations(db: Session, inviter: User) -> list[UserInvitation]:
    require_capability(db, inviter, "access.members.manage")
    _require_company_access(inviter)
    invitations = (
        db.query(UserInvitation)
        .filter(
            UserInvitation.company_id == inviter.company_id,
            UserInvitation.status.in_(
                (PENDING_STATUS, EXPIRED_STATUS, CANCELED_STATUS)
            ),
        )
        .order_by(UserInvitation.created_at.desc(), UserInvitation.id.desc())
        .all()
    )
    if any(expire_if_needed(invitation) for invitation in invitations):
        db.commit()
    return invitations


def cancel_invitation(
    db: Session,
    invitation_id: int,
    inviter: User,
) -> UserInvitation:
    require_capability(db, inviter, "access.members.manage")
    _require_company_access(inviter)
    invitation = (
        db.query(UserInvitation)
        .filter(
            UserInvitation.id == invitation_id,
            UserInvitation.company_id == inviter.company_id,
        )
        .first()
    )
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )
    expire_if_needed(invitation)
    if invitation.status != PENDING_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be cancelled",
        )
    invitation.status = CANCELED_STATUS
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def _require_company_access(inviter: User) -> None:
    if inviter.company_id is None or inviter.company is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required to manage invitations",
        )
    require_company_access(inviter.company)
