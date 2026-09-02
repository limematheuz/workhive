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
from app.services import (
    email_service,
    organization_bootstrap_service,
    privacy_service,
    user_invitation_management_service,
)
from app.services.entitlement_service import require_internal_member_capacity
from app.services.subscription_policy import require_company_access
from app.services.user_scope import is_superadmin


PENDING_STATUS = user_invitation_management_service.PENDING_STATUS
EXPIRED_STATUS = user_invitation_management_service.EXPIRED_STATUS
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


def _validate_invited_role(db: Session, role_id: int, inviter: User):
    role = role_repo.get_role(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
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
    return role


def _eligible_existing_identity(
    db: Session,
    *,
    email: str,
) -> User | None:
    """Return an unattached identity that may verify a new company invitation."""

    existing_user = user_repo.get_user_by_email(db, email)
    if not existing_user:
        return None
    if (
        existing_user.company_id is None
        and existing_user.is_active
        and not is_superadmin(existing_user)
    ):
        return existing_user
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="This email already has an active WorkHive workspace",
    )


def create_invitation(
    db: Session,
    payload: UserInvitationCreate,
    inviter: User,
) -> UserInvitation:
    if inviter.company_id is None or inviter.company is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required to invite workers",
        )
    require_company_access(inviter.company)

    email = _normalize_email(str(payload.email))
    invited_role = _validate_invited_role(db, payload.role_id, inviter)
    rejoin_user = _eligible_existing_identity(
        db,
        email=email,
    )

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
        invitation.rejoin_user_id = rejoin_user.id if rejoin_user else None
    else:
        invitation = UserInvitation(
            company_id=inviter.company_id,
            invited_by_user_id=inviter.id,
            role_id=payload.role_id,
            email=email,
            full_name=payload.full_name,
            rejoin_user_id=rejoin_user.id if rejoin_user else None,
            token_hash=_hash(token),
            code_hash=_hash(code),
            status=PENDING_STATUS,
            expires_at=expires_at,
        )
        db.add(invitation)

    if not settings.smtp_is_configured:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is not configured",
        )

    invitation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/accept-invitation#token={token}"
    )
    try:
        sent = email_service.send_worker_invitation_email(
            recipient_email=email,
            recipient_name=payload.full_name or "",
            company_name=inviter.company.name,
            invitation_url=invitation_url,
            verification_code=code,
            expires_at=expires_at,
            role_name=invited_role.name,
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

    company = invitation.company
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invited company is no longer available",
        )
    require_company_access(company)
    invited_role = role_repo.get_role(db, invitation.role_id)
    access_class = organization_bootstrap_service.legacy_role_name_access_class(
        invited_role.name if invited_role else None
    )
    if access_class is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invitation role cannot be assigned to an internal seat",
        )
    require_internal_member_capacity(
        db,
        company_id=company.id,
        access_class=access_class,
    )

    user: User
    if invitation.rejoin_user_id is not None:
        user = user_repo.get_user_by_id(db, invitation.rejoin_user_id)
        if (
            not user
            or user.email.casefold() != invitation.email.casefold()
            or user.company_id is not None
            or not user.is_active
            or is_superadmin(user)
        ):
            invitation.status = EXPIRED_STATUS
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This WorkHive account can no longer join the invited company",
            )
        user.company_id = invitation.company_id
        user.role_id = invitation.role_id
        user.session_version += 1
        # The account already has a verified email and password. An invitation
        # authorizes membership only; it is not a password-reset mechanism.
        db.add(user)
    else:
        if user_repo.get_user_by_email(db, invitation.email):
            invitation.status = EXPIRED_STATUS
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email already has a WorkHive account",
            )
        user = User(
            email=invitation.email,
            hashed_password=get_password_hash(payload.password),
            full_name=invitation.full_name,
            is_active=True,
            email_verified_at=_utcnow(),
            role_id=invitation.role_id,
            company_id=invitation.company_id,
        )
        db.add(user)
    invitation.status = ACCEPTED_STATUS
    invitation.accepted_at = _utcnow()
    db.flush()
    organization_bootstrap_service.ensure_user_membership(db, user)
    db.commit()
    db.refresh(user)
    if invitation.rejoin_user_id is None:
        privacy_service.record_registration_acknowledgements(
            db,
            user=user,
            request=request,
            policy_version=settings.PRIVACY_POLICY_VERSION,
            marketing_consent=payload.marketing_consent,
        )
    return user
