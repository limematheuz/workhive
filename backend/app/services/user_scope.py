from fastapi import HTTPException, status

from app.models.user import User


def role_name(user: User) -> str | None:
    return user.role.name if user.role else None


def is_superadmin(user: User) -> bool:
    return role_name(user) == "superadmin"


def is_platform_superadmin(user: User) -> bool:
    return is_superadmin(user) and user.company_id is None


def is_company_admin(user: User) -> bool:
    return role_name(user) == "admin"


def is_company_manager(user: User) -> bool:
    return role_name(user) == "manager"


def can_manage_company(user: User) -> bool:
    return role_name(user) in {"admin", "manager", "superadmin"}


def scoped_company_id(user: User) -> int | None:
    return None if is_platform_superadmin(user) else user.company_id


def require_company_context(user: User) -> int:
    if user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a company",
    )
    return user.company_id


def require_superadmin(user: User) -> None:
    if not is_superadmin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
