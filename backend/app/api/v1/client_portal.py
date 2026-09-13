"""Transport for the customer document portal and its company-side grants."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveAdmin,
    ActiveClientPortal,
    ActiveClientPortalUser,
    ClientPortalPrincipal,
    get_db,
)
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.client_portal import (
    ClientPortalGrantResponse,
    ClientPortalInvitationAccept,
    ClientPortalInvitationAccepted,
    ClientPortalInvitationCreate,
    ClientPortalInvitationResponse,
    ClientPortalOverviewResponse,
    ClientPortalWorkspaceResponse,
)
from app.services import audit_service, client_portal_invitation_service, client_portal_policy, client_portal_service, invoice_service


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


@router.get("/workspaces", response_model=list[ClientPortalWorkspaceResponse])
def read_client_portal_workspaces(
    db: Session = Depends(get_db),
    current_user: User = ActiveClientPortalUser,
):
    grants = client_portal_policy.list_active_client_portal_grants(db, current_user=current_user)
    return [client_portal_service.serialize_workspace(grant) for grant in grants]


@router.get("/workspaces/{grant_id}/overview", response_model=ClientPortalOverviewResponse)
def read_client_portal_overview(
    db: Session = Depends(get_db),
    principal: ClientPortalPrincipal = ActiveClientPortal,
):
    return client_portal_service.overview(db, grant=principal.grant)


@router.get("/workspaces/{grant_id}/invoices/{invoice_id}/pdf", response_class=Response)
def download_client_portal_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    principal: ClientPortalPrincipal = ActiveClientPortal,
):
    # Scope the invoice to the caller's grant before resolving any stored bytes.
    from app.repositories import client_portal as client_portal_repo

    scoped_invoice = client_portal_repo.get_invoice(
        db,
        grant=principal.grant,
        invoice_id=invoice_id,
    )
    if scoped_invoice is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    invoice, document = invoice_service.get_invoice_pdf(
        db,
        principal.grant.company_id,
        scoped_invoice.id,
    )
    return Response(
        content=document.contents,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'},
    )


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


@router.delete("/clients/{client_id}/invitations/{invitation_id}", response_model=ClientPortalInvitationResponse)
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


@router.delete("/clients/{client_id}/grants/{grant_id}", response_model=ClientPortalGrantResponse)
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
