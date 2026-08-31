"""Handle token-only company-collaboration invitation actions."""

from sqlalchemy.orm import Session

from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.repositories import user as user_repo
from app.schemas.collaboration import (
    CompanyCollaborationInvitationActivationStatus,
)
from app.services.company_collaboration_invitation_access import (
    find_pending_invitation_by_token,
    require_valid_verification_code,
    utcnow,
)


def activation_status(
    db: Session,
    token: str,
) -> CompanyCollaborationInvitationActivationStatus:
    invitation = find_pending_invitation_by_token(db, token)
    recipient = user_repo.get_user_by_email(db, invitation.email)
    mode = "sign_in" if recipient and recipient.company_id is not None else "requires_subscription"
    return CompanyCollaborationInvitationActivationStatus(mode=mode)


def decline_without_account(
    db: Session,
    *,
    token: str,
    verification_code: str,
) -> CompanyCollaborationInvitation:
    """Let a recipient decline before it has a WorkHive account."""

    invitation = find_pending_invitation_by_token(db, token)
    require_valid_verification_code(invitation, verification_code)
    invitation.status = "declined"
    invitation.accepted_at = utcnow()
    db.commit()
    db.refresh(invitation)
    from app.services.company_collaboration_invitation_notifications import (
        notify_decision,
        send_decision_emails,
    )

    inviter_company = invitation.inviter_company
    if invitation.invited_by:
        notify_decision(
            db,
            invitation=invitation,
            users=[invitation.invited_by],
            counterpart_company_name=invitation.email,
            decision="declined",
        )
    send_decision_emails(invitation, inviter_company, None, "declined")
    return invitation
