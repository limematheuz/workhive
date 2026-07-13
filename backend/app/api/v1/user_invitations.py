from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveManagerOrAdmin, get_db
from app.core.config import settings
from app.core.rate_limit import rate_limit_key, rate_limiter
from app.models.user import User
from app.schemas.user_invitation import (
    UserInvitationAccept,
    UserInvitationAccepted,
    UserInvitationCreate,
)
from app.services import audit_service, user_invitation_service


router = APIRouter()


@router.post("/", response_model=UserInvitationAccepted, status_code=status.HTTP_202_ACCEPTED)
def invite_worker(
    payload: UserInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
) -> UserInvitationAccepted:
    rate_limiter.enforce(
        rate_limit_key(request, "worker-invitation", str(payload.email)),
        settings.WORKER_INVITATION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
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


@router.post("/accept", response_model=UserInvitationAccepted)
def accept_worker_invitation(
    payload: UserInvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
) -> UserInvitationAccepted:
    rate_limiter.enforce(
        rate_limit_key(request, "worker-invitation-accept", payload.token[:16]),
        settings.WORKER_INVITATION_MAX_ATTEMPTS,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
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
