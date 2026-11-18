from dataclasses import dataclass

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.async_session import async_session_scope
from app.db.session import SessionLocal
from app.models.user import User
from app.repositories import async_user as async_user_repo
from app.repositories import user as user_repo
from app.services.subscription_policy import require_company_access
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import is_superadmin
from app.models.partner_portal_grant import PartnerPortalGrant
from app.services import partner_portal_policy
from app.models.client_portal_grant import ClientPortalGrant
from app.services import client_portal_policy
from app.repositories import company_session as company_session_repo
from app.services.company_session_principal import bind as bind_company_session


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.info.pop("record_history_actor", None)
        db.close()


async def get_async_db():
    async with async_session_scope() as db:
        yield db


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def _session_identity(
    bearer_token: str | None,
    session_token: str | None,
) -> tuple[str, int, int | None, int]:
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
        company_id = payload.get("company_id")
        membership_version=payload.get("membership_version",0)
        if email is None or type(session_version) is not int:
            raise credentials_exception
        if company_id is not None and (type(company_id) is not int or company_id<1):
            raise credentials_exception
        if type(membership_version) is not int or membership_version<0 or ("membership_version" in payload and company_id is None):
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception
    return email, session_version, company_id,membership_version


def _validate_authenticated_user(user: User | None, session_version: int, *, check_company=True) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.session_version != session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    if check_company and not is_superadmin(user) and user.company and not user.company.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company account is inactive",
        )
    return user


def get_authenticated_user(
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(
        default=None, alias=settings.SESSION_COOKIE_NAME
    ),
) -> User:
    from app.services.record_history_capture import bind_actor, clear_actor
    clear_actor(db)
    email, session_version, company_id,membership_version = _session_identity(bearer_token, session_token)
    row = company_session_repo.authenticate(db,email,company_id)
    _validate_authenticated_user(row[0] if row else None,session_version,check_company=False)
    user = _validate_authenticated_user(bind_company_session(row,company_id,session_version,membership_version),session_version)
    bind_actor(db, user)
    return user


def get_optional_authenticated_identity(
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(default=None,alias=settings.SESSION_COOKIE_NAME),
) -> User | None:
    """Identity consent for invitations; never grants any company capability."""
    from app.services.record_history_capture import clear_actor
    clear_actor(db)
    if not bearer_token and not session_token:return None
    email,version,_,_ = _session_identity(bearer_token,session_token)
    return _validate_authenticated_user(user_repo.get_user_by_email(db,email),version,check_company=False)


def get_authenticated_identity(
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(default=None,alias=settings.SESSION_COOKIE_NAME),
) -> User:
    """Authenticate only identity for personal rights, without granting tenant access."""
    from app.services.record_history_capture import clear_actor
    clear_actor(db)
    email,version,_,_ = _session_identity(bearer_token,session_token)
    return _validate_authenticated_user(user_repo.get_user_by_email(db,email),version,check_company=False)


async def get_authenticated_identity_async(
    db: AsyncSession = Depends(get_async_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(default=None,alias=settings.SESSION_COOKIE_NAME),
) -> User:
    from app.services.record_history_capture import clear_actor
    clear_actor(db)
    email,version,_,_ = _session_identity(bearer_token,session_token)
    person=await async_user_repo.get_user_by_email(db,email)
    return _validate_authenticated_user(person,version,check_company=False)


async def get_authenticated_user_async(
    db: AsyncSession = Depends(get_async_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    session_token: str | None = Cookie(
        default=None, alias=settings.SESSION_COOKIE_NAME
    ),
) -> User:
    from app.services.record_history_capture import bind_actor, clear_actor
    clear_actor(db)
    email, session_version, company_id,membership_version = _session_identity(bearer_token, session_token)
    row = await company_session_repo.authenticate_async(db,email,company_id)
    _validate_authenticated_user(row[0] if row else None,session_version,check_company=False)
    user = _validate_authenticated_user(bind_company_session(row,company_id,session_version,membership_version),session_version)
    bind_actor(db, user)
    return user


def get_current_user(
    current_user: User = Depends(get_authenticated_user),
) -> User:
    user = current_user
    if not is_superadmin(user) and user.company:
        require_company_access(user.company)
    return user


async def get_current_user_async(
    current_user: User = Depends(get_authenticated_user_async),
) -> User:
    if not is_superadmin(current_user) and current_user.company:
        require_company_access(current_user.company)
    return current_user


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


def require_role_async(*allowed_roles: str):
    async def role_checker(
        current_user: User = Depends(get_current_user_async),
    ) -> User:
        if is_superadmin(current_user):
            return current_user
        if not current_user.role or current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role.name if current_user.role else 'None'}",
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


def require_authenticated_role_async(*allowed_roles: str):
    async def role_checker(
        current_user: User = Depends(get_authenticated_user_async),
    ) -> User:
        if is_superadmin(current_user):
            return current_user
        if not current_user.role or current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role.name if current_user.role else 'None'}",
            )
        return current_user

    return role_checker


def require_company_capability(permission_code: str):
    def capability_checker(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        require_capability(db, current_user, permission_code)
        return current_user

    return capability_checker


def require_company_capability_async(permission_code: str):
    async def capability_checker(
        db: AsyncSession = Depends(get_async_db),
        current_user: User = Depends(get_current_user_async),
    ) -> User:
        await db.run_sync(
            lambda sync_db: require_capability(
                sync_db,
                current_user,
                permission_code,
            )
        )
        return current_user

    return capability_checker


@dataclass(frozen=True)
class PartnerPortalPrincipal:
    user: User
    grant: PartnerPortalGrant


@dataclass(frozen=True)
class ClientPortalPrincipal:
    user: User
    grant: ClientPortalGrant


def require_partner_portal_principal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
) -> PartnerPortalPrincipal:
    """Authenticate a sponsored portal without granting tenant access."""

    return PartnerPortalPrincipal(
        user=current_user,
        grant=partner_portal_policy.require_active_partner_portal(
            db,
            current_user=current_user,
        ),
    )


def require_client_portal_principal(
    grant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
) -> ClientPortalPrincipal:
    """Authenticate a customer workspace without opening tenant access."""

    return ClientPortalPrincipal(
        user=current_user,
        grant=client_portal_policy.require_active_client_portal(
            db,
            current_user=current_user,
            grant_id=grant_id,
        ),
    )


def require_client_portal_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
) -> User:
    client_portal_policy.list_active_client_portal_grants(db, current_user=current_user)
    return current_user


# External portal users must opt into a tenant-bound grant. Finance access is
# resolved from that grant; internal finance access remains profile-backed.
ActiveAdmin = Depends(require_role("admin"))
ActiveManagerOrAdmin = Depends(require_role("admin", "manager"))
ActiveViewer = Depends(require_role("admin", "manager", "viewer"))
ActiveUser = ActiveViewer
AsyncActiveUser = Depends(require_role_async("admin", "manager", "viewer"))
ActiveApplicationUser = Depends(
    require_role("admin", "manager", "viewer", "external_portal")
)
AsyncActiveApplicationUser = Depends(
    require_role_async("admin", "manager", "viewer", "external_portal")
)
AsyncActiveAdmin = Depends(require_role_async("admin"))
ActiveFinanceReader = Depends(require_company_capability("finance.read"))
ActiveFinanceManager = Depends(require_company_capability("finance.manage"))
AsyncActiveFinancialReader = Depends(
    require_company_capability_async("finance.read")
)
AsyncActiveFinanceManager = Depends(
    require_company_capability_async("finance.manage")
)
AsyncActiveManagerOrAdmin = Depends(require_role_async("admin", "manager"))
AsyncAuthenticatedUser = Depends(get_authenticated_user_async)
AsyncAuthenticatedAdmin = Depends(require_authenticated_role_async("admin"))
AuthenticatedUser = Depends(get_authenticated_user)
OptionalAuthenticatedIdentity = Depends(get_optional_authenticated_identity)
AuthenticatedIdentity = Depends(get_authenticated_identity)
AsyncAuthenticatedIdentity = Depends(get_authenticated_identity_async)
AuthenticatedAdmin = Depends(require_authenticated_role("admin"))
ActivePartnerPortal = Depends(require_partner_portal_principal)
ActiveClientPortal = Depends(require_client_portal_principal)
ActiveClientPortalUser = Depends(require_client_portal_user)
