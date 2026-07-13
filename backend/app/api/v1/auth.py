import secrets

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.user import UserResponse, UserRegister, PasswordResetRequest, PasswordResetConfirm
from app.services import audit_service, auth_service
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token
from app.core.config import settings
from app.core.rate_limit import rate_limit_key, rate_limiter
from app.models.user import User
from app.services.request_context import get_request_location_details

router = APIRouter()


def _cookie_options() -> dict[str, object]:
    options: dict[str, object] = {
        "secure": settings.is_production or settings.FORCE_HTTPS,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
        "path": "/",
        "max_age": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    if settings.SESSION_COOKIE_DOMAIN:
        options["domain"] = settings.SESSION_COOKIE_DOMAIN
    return options


def _delete_cookie_options() -> dict[str, object]:
    options: dict[str, object] = {
        "path": "/",
        "secure": settings.is_production or settings.FORCE_HTTPS,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
    }
    if settings.SESSION_COOKIE_DOMAIN:
        options["domain"] = settings.SESSION_COOKIE_DOMAIN
    return options


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(
    user_data: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
):
    rate_limiter.enforce(
        rate_limit_key(request, "register", user_data.email),
        settings.LOGIN_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    return auth_service.register_user(db, user_data, request)


@router.post("/login")
def login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    rate_limiter.enforce(
        rate_limit_key(request, "login", form_data.username),
        settings.LOGIN_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    access_token = create_access_token(
        data={"sub": user.email, "ver": user.session_version}
    )
    csrf_token = secrets.token_urlsafe(32)
    cookie_options = _cookie_options()
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=access_token,
        httponly=True,
        **cookie_options,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        **cookie_options,
    )
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
    current_user: User = ActiveUser,
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
    current_user: User = ActiveUser,
) -> None:
    current_user.session_version += 1
    db.add(current_user)
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
    rate_limiter.enforce(
        rate_limit_key(request, "forgot-password", reset_data.email),
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
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
    rate_limiter.enforce(
        rate_limit_key(request, "reset-password"),
        settings.PASSWORD_RESET_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    auth_service.verify_and_reset_password(db, reset_confirm)
    return {"status": "success", "message": "Password reset successfully"}
