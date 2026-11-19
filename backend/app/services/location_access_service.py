from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.user import User
from app.repositories import location as location_repo
from app.repositories import location_company_access as access_repo
from app.services.location_sharing_service import (  # noqa: F401
    create_location_access,
    delete_location_access,
    list_location_access,
    update_location_access,
)
from app.services.user_scope import (
    can_manage_company,
    is_platform_superadmin,
    require_company_context,
)
from app.services.organization_authorization_service import has_capability, require_capability


def _is_direct_company_location(location: Location, company_id: int | None) -> bool:
    if not company_id:
        return False
    return bool(
        location.owner_company_id == company_id
        or location.managing_company_id == company_id
        or (location.client and location.client.company_id == company_id)
    )


def _is_service_provider_access(access) -> bool:
    """Service providers execute work but never administer guest reservations."""
    return access.relationship_type in {"service_provider", "default_service_provider"}


def require_accessible_location(
    db: Session, current_user: User, location_id: int
) -> Location:
    company_id = (
        None
        if is_platform_superadmin(current_user)
        else require_company_context(current_user)
    )
    location = location_repo.get_location_by_id(
        db,
        location_id,
        company_id,
        allow_global=is_platform_superadmin(current_user),
    )
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found or not shared with your company",
        )
    return location


def require_readable_location(
    db: Session, current_user: User, location_id: int
) -> Location:
    location = require_accessible_location(db, current_user, location_id)
    if not is_platform_superadmin(current_user):
        require_capability(
            db,
            current_user,
            "locations.read",
            scope_type="location",
            scope_id=location_id,
        )
    return location


def require_location_capability(
    db: Session,
    current_user: User,
    location_id: int,
    capability: str,
    *,
    permission_code: str | None = None,
    allow_partner_portal_owner: bool = False,
) -> Location:
    if permission_code is not None and is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )
    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return location
    if (
        allow_partner_portal_owner
        and current_user.role
        and current_user.role.name == "partner_portal"
        and _is_direct_company_location(location, current_user.company_id)
    ):
        return location
    if capability == "can_manage_reservations" and permission_code is None:
        permission_code = "work.manage"
    if permission_code:
        require_capability(
            db,
            current_user,
            permission_code,
            scope_type="location",
            scope_id=location_id,
        )
    elif not can_manage_company(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators or managers can perform this action",
        )
    if _is_direct_company_location(location, current_user.company_id):
        return location
        
    access = access_repo.get_access(db, location_id, current_user.company_id)
    if (
        not access
        or not getattr(access, capability, False)
        or (
            capability == "can_manage_reservations"
            and _is_service_provider_access(access)
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your company does not have {capability} permission for this location",
        )
    return location


def require_company_location_capability(
    db: Session,
    *,
    company_id: int,
    location_id: int,
    capability: str,
) -> Location:
    """Authorize an integration key as its company, never as an individual user."""

    location = location_repo.get_location_by_id(db, location_id, company_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if _is_direct_company_location(location, company_id):
        return location
    access = access_repo.get_access(db, location_id, company_id)
    if (
        access is None
        or not getattr(access, capability, False)
        or (
            capability == "can_manage_reservations"
            and _is_service_provider_access(access)
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your company does not have {capability} permission for this location",
        )
    return location


def has_location_capability(
    db: Session, current_user: User, location: Location, capability: str
) -> bool:
    if is_platform_superadmin(current_user):
        return True
    if capability in {"can_manage_reservations", "can_manage_tasks"}:
        if not has_capability(db, current_user, "work.manage", scope_type="location", scope_id=location.id):
            return False
    elif not can_manage_company(current_user):
        return False
    if _is_direct_company_location(location, current_user.company_id):
        return True
        
    access = access_repo.get_access(db, location.id, current_user.company_id)
    if (
        not access
        or not getattr(access, capability, False)
        or (
            capability == "can_manage_reservations"
            and _is_service_provider_access(access)
        )
    ):
        return False
    return True


def has_location_capability_loaded(
    current_user: User,
    location: Location,
    capability: str,
    *,
    profile_allows_work: bool = False,
) -> bool:
    if is_platform_superadmin(current_user):
        return True
    if capability in {"can_manage_reservations", "can_manage_tasks"}:
        if not profile_allows_work:
            return False
    elif not can_manage_company(current_user):
        return False
    if _is_direct_company_location(location, current_user.company_id):
        return True
    return any(
        access.company_id == current_user.company_id
        and bool(getattr(access, capability, False))
        and not (
            capability == "can_manage_reservations"
            and _is_service_provider_access(access)
        )
        for access in location.company_access
    )


def require_location_owner(
    db: Session, current_user: User, location_id: int
) -> Location:
    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return location
    require_capability(
        db,
        current_user,
        "locations.manage",
        scope_type="location",
        scope_id=location_id,
    )
    owner_company_id = (
        location.owner_company_id
        or (location.client.company_id if location.client else None)
        or location.managing_company_id
    )
    if owner_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the location owner company can modify the property",
        )
    return location


def can_manage_owned_location(
    db: Session, current_user: User, location: Location
) -> bool:
    """Mirror owner-only mutation access for UI capability hints.

    The API remains authoritative; this only prevents offering controls that
    would be denied by ``require_location_owner``.
    """

    if is_platform_superadmin(current_user):
        return True
    if not _is_direct_company_location(location, current_user.company_id):
        return False
    return has_capability(
        db,
        current_user,
        "locations.manage",
        scope_type="location",
        scope_id=location.id,
    )


def can_view_sensitive(db: Session, current_user: User, location_id: int) -> bool:
    if getattr(current_user, "initial_operational_role", None):
        return False
    if is_platform_superadmin(current_user):
        return True
    if not can_manage_company(current_user):
        return False
    company_id = current_user.company_id
    location = location_repo.get_location_by_id(db, location_id, company_id)
    if not location:
        return False
    if _is_direct_company_location(location, current_user.company_id):
        return True
        
    access = access_repo.get_access(db, location_id, current_user.company_id)
    return bool(access and access.can_view_sensitive)


def can_view_sensitive_loaded(current_user: User, location: Location) -> bool:
    """Evaluate visibility from eagerly loaded location relationships."""
    if getattr(current_user, "initial_operational_role", None):
        return False
    if is_platform_superadmin(current_user):
        return True
    if not can_manage_company(current_user):
        return False
    if _is_direct_company_location(location, current_user.company_id):
        return True
    return any(
        access.company_id == current_user.company_id and access.can_view_sensitive
        for access in location.company_access
    )
