from sqlalchemy.orm import Session
from fastapi import HTTPException, Request, status
from app.models.user import User
from app.schemas.user import UserCreate, UserRegister, PasswordResetRequest, PasswordResetConfirm
from app.repositories import user as user_repo
from datetime import datetime, timezone

from app.core.security import verify_password, get_password_hash, create_password_reset_token, verify_password_reset_token
from app.repositories import role as role_repo
from app.core.config import settings
from app.services import email_service
from app.services import privacy_service
from app.services import security_token_service
from app.services.user_scope import is_superadmin
import logging
import smtplib

logger = logging.getLogger(__name__)


def register_user(
    db: Session,
    user_data: UserRegister,
    request: Request,
) -> User:
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is disabled. Contact WorkHive to activate your account.",
        )
    if user_data.policy_version != settings.PRIVACY_POLICY_VERSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The legal notice has changed. Reload it before registering.",
        )
    user = user_repo.get_user_by_email(db, user_data.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user_role = role_repo.get_role_by_name(db, "viewer")
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default role 'viewer' not configured",
        )
    safe_user_data = UserCreate(
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
        role_id=user_role.id,
        company_id=None,
        is_active=True,
    )
    try:
        created = user_repo.stage_user(db, safe_user_data)
        privacy_service.record_registration_acknowledgements(
            db,
            user=created,
            request=request,
            policy_version=user_data.policy_version,
            marketing_consent=user_data.marketing_consent,
            commit=False,
        )
        if settings.ACCOUNT_REQUEST_NOTIFICATIONS_ENABLED:
            recipient_email = settings.ACCOUNT_REQUEST_RECIPIENT_EMAIL
            if not recipient_email:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Account request notifications are not configured",
                )
            try:
                sent = email_service.send_account_request_notification(
                    recipient_email=recipient_email,
                    applicant_name=created.full_name or "",
                    applicant_email=created.email,
                )
            except Exception:
                logger.exception("Account request notification delivery failed")
                sent = False
            if not sent:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Account request notification delivery is temporarily unavailable",
                )
        db.commit()
        db.refresh(created)
        return created
    except Exception:
        db.rollback()
        raise


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = user_repo.get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    if not is_superadmin(user) and user.company:
        if not user.company.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Company account is inactive",
            )
    # A valid identity must still be able to reach the billing recovery routes
    # after a cancellation, expiry, or payment failure. Operational routes use
    # get_current_user(), which enforces the subscription separately.
    return user


def request_password_reset(db: Session, reset_data: PasswordResetRequest) -> None:
    if not settings.smtp_is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password recovery email is not configured",
        )

    user = user_repo.get_user_by_email(db, reset_data.email)
    if not user:
        return

    token = create_password_reset_token(user.email)
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    try:
        sent = email_service.send_password_reset_email(
            recipient_email=user.email,
            recipient_name=user.full_name or "usuario de WorkHive",
            reset_url=reset_url,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        logger.exception("Password reset email delivery failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password recovery email delivery is temporarily unavailable",
        )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password recovery email delivery is temporarily unavailable",
        )


def verify_and_reset_password(db: Session, reset_confirm: PasswordResetConfirm) -> None:
    payload = verify_password_reset_token(reset_confirm.token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset token is invalid or has expired",
        )
    email = payload["sub"]
    expires_at = payload.get("exp")
    if isinstance(expires_at, (int, float)):
        expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc)
    else:
        expires_at = None

    security_token_service.consume_token(
        db,
        jti=payload.get("jti"),
        purpose="password_reset",
        expires_at=expires_at,
    )

    user = user_repo.get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    user.hashed_password = get_password_hash(reset_confirm.new_password)
    user.session_version += 1
    db.add(user)
    db.commit()
    db.refresh(user)
