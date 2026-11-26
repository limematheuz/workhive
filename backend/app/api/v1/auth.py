import secrets

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session
from app.api.deps import AuthenticatedUser, AuthenticatedIdentity, get_db
from app.schemas.user import (
    EmailChangeConfirm,
    EmailChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserRegister,
    UserResponse,
)
from app.services import audit_service, auth_service, email_change_service
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token
from app.api.session_cookies import cookie_options as _cookie_options, delete_cookie_options as _delete_cookie_options, set_session_cookies
from app.services import company_session_service
from app.services.company_session_principal import identity as session_identity
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.services.request_context import get_request_location_details

router = APIRouter()


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(
    user_data: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "register",
        settings.REGISTER_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=user_data.email,
    )
    return auth_service.register_user(db, user_data, request)


@router.post("/login")
def login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "login",
        settings.LOGIN_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=form_data.username,
    )
    user = company_session_service.login_context(db,auth_service.authenticate_user(db, form_data.username, form_data.password))
    claims = company_session_service.token_claims(user)
    lifetime = min(240, settings.ACCESS_TOKEN_EXPIRE_MINUTES) if claims.get("session_scope") == "platform" else None
    access_token = create_access_token(data=claims, expires_minutes=lifetime)
    csrf_token = secrets.token_urlsafe(32)
    set_session_cookies(response, access_token, csrf_token, max_age=lifetime * 60 if lifetime else None)
    audit_service.record_event(
        db,
        actor=user,
        company_id=user.company_id,
        action="auth.login",
        entity_type="session",
        entity_id=user.id,
        request=request,
        details={
            "user_email": user.email,
            "user_name": user.full_name,
            "role": user.role.name if user.role else None,
            "company_name": user.company.name if user.company else None,
            "visitor_id": request.headers.get("x-workhive-visitor-id"),
            **get_request_location_details(request),
        },
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "csrf_token": csrf_token,
    }


@router.get("/csrf")
def get_csrf_token(
    request: Request,
    response: Response,
    current_user: User = AuthenticatedUser,
) -> dict[str, str]:
    del current_user
    csrf_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    if not csrf_token:
        csrf_token = secrets.token_urlsafe(32)
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=csrf_token,
            httponly=False,
            **_cookie_options(),
        )
    return {"csrf_token": csrf_token}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedIdentity,
) -> None:
    person=session_identity(current_user)
    person.session_version += 1
    db.add(person)
    db.commit()
    delete_options = _delete_cookie_options()
    response.delete_cookie(settings.SESSION_COOKIE_NAME, **delete_options)
    response.delete_cookie(settings.CSRF_COOKIE_NAME, **delete_options)


@router.post("/forgot-password")
def forgot_password(
    reset_data: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit(
        request,
        "forgot-password",
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=reset_data.email,
    )
    auth_service.request_password_reset(db, reset_data)
    return {
        "status": "accepted",
        "message": "If the account exists, recovery instructions will be sent.",
    }


@router.post("/reset-password")
def reset_password(
    reset_confirm: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit(
        request,
        "reset-password",
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=reset_confirm.token,
    )
    auth_service.verify_and_reset_password(db, reset_confirm)
    return {"status": "success", "message": "Password reset successfully"}


@router.post("/request-email-change", status_code=status.HTTP_202_ACCEPTED)
def request_email_change(
    change_request: EmailChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
) -> dict[str, str]:
    enforce_rate_limit(
        request,
        "request-email-change",
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=f"{current_user.id}:{change_request.new_email}",
    )
    new_email = email_change_service.request_email_change(
        db,
        current_user=current_user,
        change_request=change_request,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="auth.email_change_requested",
        entity_type="user",
        entity_id=current_user.id,
        request=request,
        details={"new_email": new_email},
    )
    return {
        "status": "accepted",
        "message": "A verification link was sent to the new email address",
    }


@router.post("/confirm-email-change")
def confirm_email_change(
    confirmation: EmailChangeConfirm,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    enforce_rate_limit(
        request,
        "confirm-email-change",
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=confirmation.token,
    )
    result = email_change_service.confirm_email_change(db, confirmation)
    audit_service.record_event(
        db,
        actor=result.user,
        company_id=result.user.company_id,
        action="auth.email_changed",
        entity_type="user",
        entity_id=result.user.id,
        request=request,
        details={
            "previous_email": result.previous_email,
            "new_email": result.new_email,
        },
    )
    delete_options = _delete_cookie_options()
    response.delete_cookie(settings.SESSION_COOKIE_NAME, **delete_options)
    response.delete_cookie(settings.CSRF_COOKIE_NAME, **delete_options)
    return {
        "status": "success",
        "message": "Email changed successfully. Sign in with the new address.",
    }
