"""Create verified company invitations and deliver their one-time credentials."""

import logging
import secrets
import smtplib
from dataclasses import dataclass
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.repositories import organization as organization_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.repositories import user_invitation as invitation_repo
from app.schemas.user_invitation import UserInvitationCreate
from app.services import email_service, user_invitation_management_service
from app.services.external_access_policy import EXTERNAL_PORTAL_ROLE_NAME
from app.services.organization_authorization_service import require_capability
from app.services.organization_bootstrap_service import legacy_role_name_access_class
from app.services.subscription_policy import require_company_access
from app.services.user_invitation_acceptance import accept_invitation
from app.services.user_invitation_secrets import generate_code, hash_secret, utcnow
from app.services.user_scope import is_superadmin

PENDING_STATUS = user_invitation_management_service.PENDING_STATUS
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CreatedInvitation:
    invitation: UserInvitation
    delivery: str
    invitation_url: str | None = None
    verification_code: str | None = None


def _validate_invited_role(db: Session, role_id: int, inviter: User):
    role = role_repo.get_role(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if inviter.role.name == "manager" and role.name != "viewer":
        raise HTTPException(status_code=403, detail="Managers can only invite field workers")
    if role.name == EXTERNAL_PORTAL_ROLE_NAME and inviter.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only company administrators can invite external portal users")
    if legacy_role_name_access_class(role.name) is None and role.name != EXTERNAL_PORTAL_ROLE_NAME:
        raise HTTPException(status_code=403, detail="This role cannot be assigned through a company invitation")
    return role


def _eligible_existing_identity(db: Session, *, email: str, company_id: int, role_name: str) -> User | None:
    user = user_repo.get_user_by_email(db, email)
    if user is None:
        return None
    internal = legacy_role_name_access_class(user.role.name if user.role else None) is not None
    compatible = internal if role_name != EXTERNAL_PORTAL_ROLE_NAME else bool(user.role and user.role.name == EXTERNAL_PORTAL_ROLE_NAME)
    if not user.is_active or is_superadmin(user) or not compatible:
        raise HTTPException(status_code=409, detail="This identity cannot receive this type of company access")
    membership = organization_repo.get_user_membership(db, company_id=company_id, user_id=user.id)
    if membership and membership.status == "active" or (not membership and user.company_id == company_id and internal):
        raise HTTPException(status_code=409, detail="This person already has access to this company")
    if role_name == EXTERNAL_PORTAL_ROLE_NAME:
        grant = invitation_repo.accountant_grant(db, company_id=company_id, user_id=user.id)
        if grant and grant.status == "active":
            raise HTTPException(status_code=409, detail="This person already has access to this company")
    return user


def _deliver_email(invitation: UserInvitation, *, inviter: User, role_name: str, url: str, code: str) -> None:
    if not settings.smtp_is_configured:
        raise HTTPException(status_code=503, detail="Invitation email delivery is not configured. Create an invitation link instead.")
    try:
        sent = email_service.send_worker_invitation_email(
            recipient_email=invitation.email, recipient_name=invitation.full_name or "",
            company_name=inviter.company.name, invitation_url=url,
            verification_code=code, expires_at=invitation.expires_at, role_name=role_name,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException) as error:
        logger.warning("Worker invitation email delivery failed (%s)", type(error).__name__)
        sent = False
    if not sent:
        raise HTTPException(status_code=503, detail="Invitation email delivery is temporarily unavailable")


def create_invitation(db: Session, payload: UserInvitationCreate, inviter: User) -> CreatedInvitation:
    require_capability(db, inviter, "access.members.manage")
    if inviter.company_id is None or inviter.company is None:
        raise HTTPException(status_code=409, detail="A company is required to invite workers")
    require_company_access(inviter.company)
    email = str(payload.email).strip().lower()
    role = _validate_invited_role(db, payload.role_id, inviter)
    existing_user = _eligible_existing_identity(db, email=email, company_id=inviter.company_id, role_name=role.name)
    invitation = invitation_repo.pending(db, company_id=inviter.company_id, email=email)
    token, code = secrets.token_urlsafe(32), generate_code()
    if invitation is None:
        invitation = UserInvitation(company_id=inviter.company_id, email=email, status=PENDING_STATUS)
        db.add(invitation)
    invitation.invited_by_user_id = inviter.id
    invitation.role_id = role.id
    invitation.full_name = payload.full_name
    invitation.rejoin_user_id = existing_user.id if existing_user else None
    invitation.token_hash, invitation.code_hash = hash_secret(token), hash_secret(code)
    invitation.failed_attempts = 0
    invitation.expires_at = utcnow() + timedelta(hours=settings.WORKER_INVITATION_EXPIRE_HOURS)
    url = f"{settings.FRONTEND_URL.rstrip('/')}/accept-invitation#token={token}"
    try:
        if payload.delivery == "email":
            _deliver_email(invitation, inviter=inviter, role_name=role.name, url=url, code=code)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(invitation)
    return CreatedInvitation(
        invitation=invitation, delivery=payload.delivery,
        invitation_url=url if payload.delivery == "link" else None,
        verification_code=code if payload.delivery == "link" else None,
    )
