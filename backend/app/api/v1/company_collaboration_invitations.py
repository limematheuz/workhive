"""Transport layer for company-to-company email invitations."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.collaboration import (
    CollaborationResponse,
    CompanyCollaborationInvitationAccept,
    CompanyCollaborationInvitationAccessCheck,
    CompanyCollaborationInvitationActivationStatus,
    CompanyCollaborationInvitationCreate,
    CompanyCollaborationInvitationCodeVerification,
    CompanyCollaborationInvitationResponse,
)
from app.services import audit_service, company_collaboration_invitation_service
from app.services import company_collaboration_invitation_activation_service


router = APIRouter()


@router.get("/sent", response_model=list[CompanyCollaborationInvitationResponse])
def read_sent_company_invitations(
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return company_collaboration_invitation_service.list_sent_invitations(db, current_user)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def invite_company_by_email(
    payload: CompanyCollaborationInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    enforce_rate_limit(request, "company-collaboration-invitation", settings.WORKER_INVITATION_RATE_LIMIT, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=str(payload.email))
    invitation = company_collaboration_invitation_service.create_invitation(db, payload, current_user)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="company_collaboration.invited", entity_type="company_collaboration_invitation", entity_id=invitation.id, request=request, details={"role_type": invitation.role_type})
    return {"id": invitation.id, "status": invitation.status}


@router.post("/accept", response_model=CollaborationResponse)
def accept_company_invitation(payload: CompanyCollaborationInvitationAccept, request: Request, db: Session = Depends(get_db), current_user: User = ActiveAdmin):
    enforce_rate_limit(request, "company-collaboration-invitation-verification", settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=payload.token)
    collaboration = company_collaboration_invitation_service.accept_invitation(db, payload, current_user)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="company_collaboration.invitation_accepted", entity_type="company_collaboration", entity_id=collaboration.id, request=request, details={"role_type": collaboration.role_type})
    return collaboration


@router.post("/verify-access", status_code=status.HTTP_204_NO_CONTENT)
def verify_company_invitation_access(payload: CompanyCollaborationInvitationAccessCheck, db: Session = Depends(get_db), current_user: User = ActiveAdmin):
    company_collaboration_invitation_service.verify_invitation_access(db, payload, current_user)


@router.post(
    "/verify-code",
    response_model=CompanyCollaborationInvitationCodeVerification,
)
def verify_company_invitation_code(
    payload: CompanyCollaborationInvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "company-collaboration-invitation-verification",
        settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.token,
    )
    email = company_collaboration_invitation_service.verify_invitation_code(db, payload)
    return CompanyCollaborationInvitationCodeVerification(email=email)


@router.post("/activation-status", response_model=CompanyCollaborationInvitationActivationStatus)
def read_company_invitation_activation_status(payload: CompanyCollaborationInvitationAccessCheck, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "company-collaboration-invitation-status", settings.COMPANY_INVITATION_STATUS_RATE_LIMIT, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=payload.token)
    return company_collaboration_invitation_activation_service.activation_status(db, payload.token)


@router.post("/decline-external", status_code=status.HTTP_204_NO_CONTENT)
def decline_company_invitation_without_account(payload: CompanyCollaborationInvitationAccept, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "company-collaboration-invitation-verification", settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=payload.token)
    company_collaboration_invitation_activation_service.decline_without_account(db, token=payload.token, verification_code=payload.verification_code)


@router.post("/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_company_invitation(payload: CompanyCollaborationInvitationAccept, request: Request, db: Session = Depends(get_db), current_user: User = ActiveAdmin):
    enforce_rate_limit(request, "company-collaboration-invitation-verification", settings.COMPANY_INVITATION_VERIFICATION_MAX_ATTEMPTS, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS, identity=payload.token)
    invitation = company_collaboration_invitation_service.decline_invitation(db, payload, current_user)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="company_collaboration.invitation_declined", entity_type="company_collaboration_invitation", entity_id=invitation.id, request=request, details={"role_type": invitation.role_type})


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_company_invitation(invitation_id: int, request: Request, db: Session = Depends(get_db), current_user: User = ActiveAdmin):
    invitation = company_collaboration_invitation_service.revoke_invitation(db, invitation_id, current_user)
    audit_service.record_event(db, actor=current_user, company_id=current_user.company_id, action="company_collaboration.invitation_revoked", entity_type="company_collaboration_invitation", entity_id=invitation.id, request=request, details={"role_type": invitation.role_type})
