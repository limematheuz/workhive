"""Location sharing grant management for direct location owners."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import location_company_access as access_repo
from app.schemas.location_company_access import (
    LocationCompanyAccessCreate,
    LocationCompanyAccessUpdate,
)
from app.services.user_scope import (
    can_manage_company,
    is_company_admin,
    is_platform_superadmin,
)


def _is_direct_owner(location: Location, company_id: int | None) -> bool:
    if not company_id:
        return False
    return bool(
        location.owner_company_id == company_id
        or location.managing_company_id == company_id
        or (location.client and location.client.company_id == company_id)
    )


def list_location_access(db: Session, current_user: User, location_id: int):
    from app.services.location_access_service import require_accessible_location

    location = require_accessible_location(db, current_user, location_id)
    if is_platform_superadmin(current_user):
        return access_repo.list_access(db, location_id)
    if not is_company_admin(current_user) or not _is_direct_owner(
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
