from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.user_invitation import (
    UserInvitationAccept,
    UserInvitationAccepted,
    UserInvitationCreate,
    UserInvitationResponse,
)
from app.services import (
    audit_service,
    user_invitation_management_service,
    user_invitation_service,
)


router = APIRouter()


def invitation_response(invitation) -> UserInvitationResponse:
    return UserInvitationResponse(
        id=invitation.id,
        email=invitation.email,
        full_name=invitation.full_name,
        role_id=invitation.role_id,
        role_name=invitation.role.name if invitation.role else "viewer",
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        rejoin_existing_identity=invitation.rejoin_user_id is not None,
    )


@router.get("/", response_model=list[UserInvitationResponse])
def list_worker_invitations(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
) -> list[UserInvitationResponse]:
    invitations = user_invitation_management_service.list_company_invitations(
        db,
        current_user,
    )
    return [invitation_response(invitation) for invitation in invitations]


@router.post("/", response_model=UserInvitationAccepted, status_code=status.HTTP_202_ACCEPTED)
def invite_worker(
    payload: UserInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
) -> UserInvitationAccepted:
    enforce_rate_limit(
        request,
        "worker-invitation",
        settings.WORKER_INVITATION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(payload.email),
    )
    invitation = user_invitation_service.create_invitation(db, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=invitation.company_id,
        action="user.invited",
        entity_type="user_invitation",
        entity_id=invitation.id,
        request=request,
        details={"role_id": invitation.role_id},
    )
    return UserInvitationAccepted()


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_worker_invitation(
    invitation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    invitation = user_invitation_management_service.cancel_invitation(
        db,
        invitation_id,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=invitation.company_id,
        action="user.invitation_cancelled",
        entity_type="user_invitation",
        entity_id=invitation.id,
        request=request,
    )


@router.post("/accept", response_model=UserInvitationAccepted)
def accept_worker_invitation(
    payload: UserInvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
) -> UserInvitationAccepted:
    enforce_rate_limit(
        request,
        "worker-invitation-accept",
        settings.WORKER_INVITATION_MAX_ATTEMPTS,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.token,
    )
    user = user_invitation_service.accept_invitation(db, payload, request)
    audit_service.record_event(
        db,
        actor=user,
        company_id=user.company_id,
        action="user.invitation_accepted",
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    return UserInvitationAccepted()
