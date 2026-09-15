"""Transport for the customer portal invitation and grant lifecycle."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.client_portal import (
    ClientPortalGrantResponse,
    ClientPortalInvitationAccept,
    ClientPortalInvitationAccepted,
    ClientPortalInvitationCreate,
    ClientPortalInvitationResponse,
)
from app.services import audit_service, client_portal_invitation_service


router = APIRouter()


def _company_id(current_user: User) -> int:
    if current_user.company_id is None:
        raise RuntimeError("Active admin must have a company")
    return current_user.company_id


def _grant_response(grant) -> dict:
    return {
        "id": grant.id,
        "email": grant.user.email,
        "full_name": grant.user.full_name,
        "status": grant.status,
        "expires_at": grant.expires_at,
        "created_at": grant.created_at,
    }


@router.get("/clients/{client_id}/invitations", response_model=list[ClientPortalInvitationResponse])
def read_client_portal_invitations(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_portal_invitation_service.list_invitations(
        db,
        company_id=_company_id(current_user),
        client_id=client_id,
    )


@router.post(
    "/clients/{client_id}/invitations",
    response_model=ClientPortalInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_portal_invitation(
    client_id: int,
    payload: ClientPortalInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    enforce_rate_limit(
        request,
        "client-portal-invitation",
        settings.WORKER_INVITATION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(payload.email),
    )
    invitation = client_portal_invitation_service.create_invitation(
        db,
        company_id=_company_id(current_user),
        client_id=client_id,
        payload=payload,
        inviter=current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="client_portal.invited",
        entity_type="client_portal_invitation",
        entity_id=invitation.id,
        request=request,
        details={"client_id": client_id, "email": invitation.email},
    )
    return invitation


@router.delete(
    "/clients/{client_id}/invitations/{invitation_id}",
    response_model=ClientPortalInvitationResponse,
)
def revoke_client_portal_invitation(
    client_id: int,
    invitation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    invitation = client_portal_invitation_service.revoke_invitation(
        db,
        company_id=_company_id(current_user),
        client_id=client_id,
        invitation_id=invitation_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="client_portal.invitation_revoked",
        entity_type="client_portal_invitation",
        entity_id=invitation.id,
        request=request,
        details={"client_id": client_id},
    )
    return invitation


@router.get("/clients/{client_id}/grants", response_model=list[ClientPortalGrantResponse])
def read_client_portal_grants(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return [
        _grant_response(grant)
        for grant in client_portal_invitation_service.list_grants(
            db,
            company_id=_company_id(current_user),
            client_id=client_id,
        )
    ]


@router.delete(
    "/clients/{client_id}/grants/{grant_id}",
    response_model=ClientPortalGrantResponse,
)
def revoke_client_portal_grant(
    client_id: int,
    grant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    grant = client_portal_invitation_service.revoke_grant(
        db,
        company_id=_company_id(current_user),
        client_id=client_id,
        grant_id=grant_id,
        revoked_by_user_id=current_user.id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="client_portal.grant_revoked",
        entity_type="client_portal_grant",
        entity_id=grant.id,
        request=request,
        details={"client_id": client_id, "user_id": grant.user_id},
    )
    return _grant_response(grant)


@router.post("/invitations/accept", response_model=ClientPortalInvitationAccepted)
def accept_client_portal_invitation(
    payload: ClientPortalInvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "client-portal-invitation-verification",
        settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.token,
    )
    invitation = client_portal_invitation_service.accept_invitation(
        db,
        payload=payload,
        request=request,
    )
    if invitation.accepted_user is not None:
        audit_service.record_event(
            db,
            actor=invitation.accepted_user,
            company_id=invitation.company_id,
            action="client_portal.accepted",
            entity_type="client_portal_invitation",
            entity_id=invitation.id,
            request=request,
            details={"client_id": invitation.client_id},
        )
    return ClientPortalInvitationAccepted()
