from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import location as location_repo
from app.repositories import location_company_access as access_repo
from app.schemas.location_company_access import (
    LocationCompanyAccessCreate,
    LocationCompanyAccessUpdate,
)
from app.services.user_scope import (
    can_manage_company,
    is_company_admin,
    is_platform_superadmin,
    scoped_company_id,
)


def _is_direct_company_location(location: Location, company_id: int | None) -> bool:
    if not company_id:
        return False
    return bool(
        location.owner_company_id == company_id
        or location.managing_company_id == company_id
        or (location.client and location.client.company_id == company_id)
    )


def require_accessible_location(db: Session, current_user: User, location_id: int) -> Location:
    company_id = scoped_company_id(current_user)
    location = location_repo.get_location_by_id(db, location_id, company_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found or not shared with your company",
        )
    return location


def require_location_capability(
    db: Session, current_user: User, location_id: int, capability: str
) -> Location:
    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return location
    if not can_manage_company(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators or managers can perform this action",
        )
    if _is_direct_company_location(location, current_user.company_id):
        return location
        
    access = access_repo.get_access(db, location_id, current_user.company_id)
    if not access or not getattr(access, capability, False):
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
    if not can_manage_company(current_user):
        return False
    if _is_direct_company_location(location, current_user.company_id):
        return True
        
    access = access_repo.get_access(db, location.id, current_user.company_id)
    if not access or not getattr(access, capability, False):
        return False
    return True


def require_location_owner(db: Session, current_user: User, location_id: int) -> Location:
    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return location
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


def can_view_sensitive(db: Session, current_user: User, location_id: int) -> bool:
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


def list_location_access(db: Session, current_user: User, location_id: int):
    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return access_repo.list_access(db, location_id)
    if not is_company_admin(current_user) or not _is_direct_company_location(
        location, current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the administrator of the location owner can manage sharing",
        )
    return access_repo.list_access(db, location_id)


def create_location_access(
    db: Session, current_user: User, location_id: int, data: LocationCompanyAccessCreate
):
    list_location_access(db, current_user, location_id)
    if not company_repo.get_company_by_id(db, data.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    if access_repo.get_access(db, location_id, data.company_id):
        raise HTTPException(status_code=409, detail="Company already has access")
    return access_repo.create_access(db, location_id, data)


def update_location_access(
    db: Session,
    current_user: User,
    location_id: int,
    company_id: int,
    data: LocationCompanyAccessUpdate,
):
    list_location_access(db, current_user, location_id)
    access = access_repo.get_access(db, location_id, company_id)
    if not access:
        raise HTTPException(status_code=404, detail="Location company access not found")
    return access_repo.update_access(db, access, data)


def delete_location_access(
    db: Session, current_user: User, location_id: int, company_id: int
) -> None:
    is_self_removal = (
        can_manage_company(current_user)
        and current_user.company_id == company_id
    )

    if not is_self_removal:
        list_location_access(db, current_user, location_id)

    access = access_repo.get_access(db, location_id, company_id)
    if not access:
        raise HTTPException(status_code=404, detail="Location company access not found")
    location = db.query(Location).filter(Location.id == location_id).first()
    if location and location.default_service_provider_id == company_id:
        location.default_service_provider_id = None
    access_repo.delete_access(db, access)
    db.commit()
