"""Transport for host-sponsored property-manager portal invitations."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.sponsored_partner_invitation import (
    SponsoredPartnerInvitationAccept,
    SponsoredPartnerInvitationAccepted,
    SponsoredPartnerInvitationCreate,
    SponsoredPartnerInvitationResponse,
)
from app.services import audit_service, sponsored_partner_invitation_service

router = APIRouter()


@router.get("/sent", response_model=list[SponsoredPartnerInvitationResponse])
def read_sent_sponsored_partner_invitations(
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return sponsored_partner_invitation_service.list_sent_invitations(
        db,
        inviter=current_user,
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def invite_sponsored_property_manager(
    payload: SponsoredPartnerInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    enforce_rate_limit(
        request,
        "sponsored-partner-invitation",
        settings.WORKER_INVITATION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(payload.email),
    )
    invitation = sponsored_partner_invitation_service.create_invitation(
        db,
        payload=payload,
        inviter=current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="partner_portal.sponsored_invited",
        entity_type="sponsored_partner_invitation",
        entity_id=invitation.id,
        request=request,
        details={"email": invitation.email},
    )
    return {"id": invitation.id, "status": invitation.status}


@router.post("/accept", response_model=SponsoredPartnerInvitationAccepted)
def accept_sponsored_property_manager_invitation(
    payload: SponsoredPartnerInvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "sponsored-partner-invitation-verification",
        settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.token,
    )
    invitation = sponsored_partner_invitation_service.accept_invitation(
        db,
        payload=payload,
        request=request,
    )
    accepted_user = invitation.accepted_user
    if accepted_user is not None:
        audit_service.record_event(
            db,
            actor=accepted_user,
            company_id=invitation.host_company_id,
            action="partner_portal.sponsored_accepted",
            entity_type="sponsored_partner_invitation",
            entity_id=invitation.id,
            request=request,
            details={"partner_company_id": invitation.accepted_company_id},
        )
    return SponsoredPartnerInvitationAccepted()


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_sponsored_property_manager_invitation(
    invitation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
) -> None:
    invitation = sponsored_partner_invitation_service.revoke_invitation(
        db,
        invitation_id=invitation_id,
        inviter=current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="partner_portal.sponsored_invitation_revoked",
        entity_type="sponsored_partner_invitation",
        entity_id=invitation.id,
        request=request,
    )
