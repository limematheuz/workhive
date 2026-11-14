"""Session revocation and directory-access policies for the user workflow."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserUpdate
from app.services.organization_authorization_service import has_capability
from app.services.user_scope import is_platform_superadmin, require_company_context


ASSIGNABLE_DIRECTORY_CAPABILITIES = (
    "access.members.read",
    "work.manage",
    "time.read",
    "time.approve",
)


def require_assignable_directory_access(db: Session, current_user: User) -> int:
    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )
    company_id = require_company_context(current_user)
    if not any(
        has_capability(db, current_user, capability)
        for capability in ASSIGNABLE_DIRECTORY_CAPABILITIES
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return company_id


def requires_session_revocation(user: User, update: UserUpdate) -> bool:
    if update.password is not None:
        return True
    return any(
        field in update.model_fields_set
        and getattr(update, field) is not None
        and getattr(update, field) != getattr(user, field)
        for field in ("is_active", "role_id")
    )
