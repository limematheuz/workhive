import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.schemas.user_invitation import UserInvitationAccept, UserInvitationCreate
from app.services import email_service, privacy_service
from app.services.subscription_policy import require_active_user_capacity
from app.services.user_scope import is_superadmin


PENDING_STATUS = "pending"
EXPIRED_STATUS = "expired"
ACCEPTED_STATUS = "accepted"
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(100_000_000):08d}"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_invited_role(db: Session, role_id: int, inviter: User) -> None:
    role = role_repo.get_role(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if inviter.role.name == "manager" and role.name != "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers can only invite field workers",
        )
    if not is_superadmin(inviter) and role.name == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can assign the superadmin role",
        )


def create_invitation(
    db: Session,
    payload: UserInvitationCreate,
    inviter: User,
) -> UserInvitation:
    if not settings.smtp_is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is not configured",
        )
    if inviter.company_id is None or inviter.company is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required to invite workers",
        )

    email = _normalize_email(str(payload.email))
    if user_repo.get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a WorkHive account",
        )
    _validate_invited_role(db, payload.role_id, inviter)
    require_active_user_capacity(db, inviter.company)

    existing = (
        db.query(UserInvitation)
        .filter(
            UserInvitation.email == email,
            UserInvitation.status == PENDING_STATUS,
        )
        .first()
    )
    if existing and existing.company_id != inviter.company_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a pending invitation for another company",
        )

    token = secrets.token_urlsafe(32)
    code = _generate_code()
    now = _utcnow()
    expires_at = now + timedelta(hours=settings.WORKER_INVITATION_EXPIRE_HOURS)
    if existing:
        invitation = existing
        invitation.invited_by_user_id = inviter.id
        invitation.role_id = payload.role_id
        invitation.full_name = payload.full_name
        invitation.token_hash = _hash(token)
        invitation.code_hash = _hash(code)
        invitation.failed_attempts = 0
        invitation.expires_at = expires_at
    else:
        invitation = UserInvitation(
            company_id=inviter.company_id,
            invited_by_user_id=inviter.id,
            role_id=payload.role_id,
            email=email,
            full_name=payload.full_name,
            token_hash=_hash(token),
            code_hash=_hash(code),
            status=PENDING_STATUS,
            expires_at=expires_at,
        )
        db.add(invitation)

    invitation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/accept-invitation?token={token}"
    )
    try:
        sent = email_service.send_worker_invitation_email(
            recipient_email=email,
            recipient_name=payload.full_name or "",
            company_name=inviter.company.name,
            invitation_url=invitation_url,
            verification_code=code,
            expires_at=expires_at,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException) as error:
        logger.warning(
            "Worker invitation email delivery failed (%s)",
            type(error).__name__,
        )
        sent = False
    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is temporarily unavailable",
        )

    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(
    db: Session,
    payload: UserInvitationAccept,
    request: Request,
) -> User:
    invitation = (
        db.query(UserInvitation)
        .filter(UserInvitation.token_hash == _hash(payload.token))
        .first()
    )
    if not invitation or invitation.status != PENDING_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation is invalid or has already been used",
        )

    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= _utcnow():
        invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Ask your administrator to send a new one.",
        )

    if not secrets.compare_digest(invitation.code_hash, _hash(payload.code)):
        invitation.failed_attempts += 1
        if invitation.failed_attempts >= settings.WORKER_INVITATION_MAX_ATTEMPTS:
            invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid",
        )

    if user_repo.get_user_by_email(db, invitation.email):
        invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a WorkHive account",
        )

    company = invitation.company
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invited company is no longer available",
        )
    require_active_user_capacity(db, company)

    user = User(
        email=invitation.email,
        hashed_password=get_password_hash(payload.password),
        full_name=invitation.full_name,
        is_active=True,
        email_verified_at=_utcnow(),
        role_id=invitation.role_id,
        company_id=invitation.company_id,
    )
    invitation.status = ACCEPTED_STATUS
    invitation.accepted_at = _utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    privacy_service.record_registration_acknowledgements(
        db,
        user=user,
        request=request,
        policy_version=settings.PRIVACY_POLICY_VERSION,
        marketing_consent=payload.marketing_consent,
    )
    return user
