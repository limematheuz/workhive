"""Persist and announce a company-collaboration invitation decision."""

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.user import User
from app.repositories import company_collaboration as collaboration_repo
from app.services.company_client_service import ensure_collaboration_clients
from app.services.company_collaboration_invitation_access import require_active_company, utcnow
from app.services.company_collaboration_invitation_notifications import (
    notify_decision,
    send_decision_emails,
)


ACCEPTED_STATUS = "accepted"


def accept_for_company(
    db: Session,
    *,
    invitation: CompanyCollaborationInvitation,
    accepting_company: Company,
    accepting_user: User,
) -> CompanyCollaboration:
    """Accept once, regardless of whether the recipient is new or established."""

    inviter_company = require_active_company(db, invitation.inviter_company_id)
    collaboration = collaboration_repo.get_collaboration(
        db,
        inviter_company.id,
        accepting_company.id,
    )
    if collaboration is None:
        collaboration = CompanyCollaboration(
            initiator_company_id=inviter_company.id,
            partner_company_id=accepting_company.id,
            role_type=invitation.role_type,
            status=ACCEPTED_STATUS,
        )
        db.add(collaboration)
    else:
        collaboration.initiator_company_id = inviter_company.id
        collaboration.partner_company_id = accepting_company.id
        collaboration.role_type = invitation.role_type
        collaboration.status = ACCEPTED_STATUS

    ensure_collaboration_clients(db, inviter_company, accepting_company)
    invitation.status = ACCEPTED_STATUS
    invitation.accepted_at = utcnow()
    invitation.accepted_company_id = accepting_company.id
    db.commit()
    db.refresh(collaboration)

    notify_decision(
        db,
        invitation=invitation,
        users=[accepting_user],
        counterpart_company_name=inviter_company.name,
        decision=ACCEPTED_STATUS,
    )
    if invitation.invited_by:
        notify_decision(
            db,
            invitation=invitation,
            users=[invitation.invited_by],
            counterpart_company_name=accepting_company.name,
            decision=ACCEPTED_STATUS,
        )
    send_decision_emails(invitation, inviter_company, accepting_company, ACCEPTED_STATUS)
    return collaboration
