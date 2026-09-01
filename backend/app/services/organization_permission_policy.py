from collections.abc import Iterable

from fastapi import HTTPException, status


# These actions can change who controls the company. They intentionally stay on
# the WorkHive-managed company administrator profile instead of being delegated
# through a custom profile.
SYSTEM_ONLY_PERMISSION_CODES = frozenset(
    {
        "access.members.manage",
        "access.profiles.manage",
        "company.settings.manage",
    }
)


PERMISSION_RECOMMENDED_AUDIENCES: dict[str, tuple[str, ...]] = {
    "access.members.read": ("people_managers", "responsibles"),
    "access.members.manage": ("company_administrators",),
    "access.profiles.read": ("company_administrators", "responsibles"),
    "access.profiles.manage": ("company_administrators",),
    "access.scopes.manage": ("company_administrators", "responsibles"),
    "company.settings.manage": ("company_administrators",),
    "organization.departments.read": ("operations", "responsibles"),
    "organization.departments.manage": ("operations", "responsibles"),
    "organization.teams.read": ("operations", "responsibles"),
    "organization.teams.manage": ("operations", "responsibles"),
}


def is_system_only_permission(permission_code: str) -> bool:
    return permission_code in SYSTEM_ONLY_PERMISSION_CODES


def recommended_audiences(permission_code: str) -> tuple[str, ...]:
    return PERMISSION_RECOMMENDED_AUDIENCES.get(permission_code, ())


def require_custom_profile_permissions_assignable(permission_codes: Iterable[str]) -> None:
    reserved_codes = sorted(
        set(permission_codes).intersection(SYSTEM_ONLY_PERMISSION_CODES)
    )
    if reserved_codes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected permissions are reserved for company administrators",
        )
