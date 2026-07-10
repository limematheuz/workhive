from app.db.session import SessionLocal
from sqlalchemy.orm import Session
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.repositories import user as user_repo
from app.models.user import User
from app.services.subscription_policy import require_company_access
from app.services.user_scope import is_superadmin


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_authenticated_user(
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(default=None, alias=settings.SESSION_COOKIE_NAME),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = bearer_token or session_token
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email = payload.get("sub")
        session_version = payload.get("ver")
        if email is None or not isinstance(session_version, int):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = user_repo.get_user_by_email(db, email)
    if not user:
        raise credentials_exception
    if user.session_version != session_version:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    if (
        not is_superadmin(user)
        and user.company
        and not user.company.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company account is inactive",
        )
    return user


def get_current_user(
    current_user: User = Depends(get_authenticated_user),
) -> User:
    user = current_user
    if not is_superadmin(user) and user.company:
        require_company_access(user.company)
    return user


def require_role(*allowed_roles: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if is_superadmin(current_user):
            return current_user
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
            )
        return current_user
    return role_checker


def require_authenticated_role(*allowed_roles: str):
    def role_checker(
        current_user: User = Depends(get_authenticated_user),
    ) -> User:
        if is_superadmin(current_user):
            return current_user
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return role_checker


ActiveAdmin = Depends(require_role("admin"))
ActiveManagerOrAdmin = Depends(require_role("admin", "manager"))
ActiveViewer = Depends(require_role("admin", "manager", "viewer"))
ActiveUser = Depends(get_current_user)
AuthenticatedUser = Depends(get_authenticated_user)
AuthenticatedAdmin = Depends(require_authenticated_role("admin"))
