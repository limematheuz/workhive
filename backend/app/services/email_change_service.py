import logging
import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_email_change_token,
    verify_email_change_token,
    verify_password,
)
from app.models.user import User
from app.repositories import user as user_repo
from app.schemas.user import EmailChangeConfirm, EmailChangeRequest
from app.services import email_service, security_token_service


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConfirmedEmailChange:
    user: User
    previous_email: str
    new_email: str


def request_email_change(
    db: Session,
    *,
    current_user: User,
    change_request: EmailChangeRequest,
) -> str:
    if not settings.smtp_is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email change verification is not configured",
        )
    try:
        password_matches = verify_password(
            change_request.current_password,
            current_user.hashed_password,
        )
    except ValueError:
        password_matches = False
    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    new_email = str(change_request.new_email).strip().lower()
    if new_email == current_user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new email must be different from the current email",
        )
    existing_user = user_repo.get_user_by_email(db, new_email)
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    token = create_email_change_token(
        user_id=current_user.id,
        current_email=current_user.email,
        new_email=new_email,
        session_version=current_user.session_version,
    )
    confirmation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/confirm-email-change#token={token}"
    )
    try:
        sent = email_service.send_email_change_verification_email(
            recipient_email=new_email,
            recipient_name=current_user.full_name or "usuario de WorkHive",
            confirmation_url=confirmation_url,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        logger.exception("Email change verification delivery failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email change verification is temporarily unavailable",
        )
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email change verification is temporarily unavailable",
        )
    return new_email


def confirm_email_change(
    db: Session,
    confirmation: EmailChangeConfirm,
) -> ConfirmedEmailChange:
    payload = verify_email_change_token(confirmation.token)
    if not payload:
        raise _invalid_confirmation()

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise _invalid_confirmation() from None

    user = user_repo.get_user_by_id(db, user_id)
    current_email = str(payload["current_email"]).strip().lower()
    new_email = str(payload["new_email"]).strip().lower()
    if (
        not user
        or user.email.strip().lower() != current_email
        or user.session_version != payload["ver"]
        or not user.is_active
    ):
        raise _invalid_confirmation()

    existing_user = user_repo.get_user_by_email(db, new_email)
    if existing_user and existing_user.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    expires_at = _token_expiry(payload.get("exp"))
    security_token_service.consume_token(
        db,
        jti=payload.get("jti"),
        purpose="email_change",
        expires_at=expires_at,
    )
    previous_email = user.email
    user.email = new_email
    user.email_verified_at = datetime.now(timezone.utc)
    user.session_version += 1
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    db.refresh(user)

    try:
        email_service.send_email_changed_notice(
            recipient_email=previous_email,
            recipient_name=user.full_name or "usuario de WorkHive",
            new_email=new_email,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        logger.warning("Email change security notice delivery failed", exc_info=True)

    return ConfirmedEmailChange(
        user=user,
        previous_email=previous_email,
        new_email=new_email,
    )


def _token_expiry(value: object) -> datetime | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return None


def _invalid_confirmation() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="The email change link is invalid or has expired",
    )
