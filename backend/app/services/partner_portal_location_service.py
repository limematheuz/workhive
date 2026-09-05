"""Property operations for the restricted sponsored partner portal."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.partner_portal_grant import PartnerPortalGrant
from app.repositories import location as location_repo
from app.schemas.location import LocationCreate, LocationResponse, LocationUpdate
from app.schemas.partner_portal import PartnerPortalLocationCreate, PartnerPortalLocationUpdate
from app.services import location_catalog_service, location_service
from app.services.entitlement_service import require_company_feature


def _require_locations_access(db: Session, grant: PartnerPortalGrant) -> None:
    require_company_feature(db, company_id=grant.host_company_id, code="features.locations")


def require_owned_location(db: Session, grant: PartnerPortalGrant, location_id: int) -> Location:
    location = location_repo.get_location_by_id(db, location_id, grant.partner_company_id)
    if location is None or location.owner_company_id != grant.partner_company_id or not location.is_active:
        raise HTTPException(status_code=404, detail="Property not found")
    return location


def _serialize(location: Location) -> LocationResponse:
    return LocationResponse.model_validate(location).model_copy(
        update={
            "can_manage_reservations": True,
            "can_manage_tasks": False,
            "shared_companies": [access.company_id for access in location.company_access],
        }
    )


def list_locations(db: Session, *, grant: PartnerPortalGrant) -> list[LocationResponse]:
    _require_locations_access(db, grant)
    locations = location_repo.get_locations_by_client(db, grant.partner_company_id, skip=0, limit=10_000)
    return [_serialize(location) for location in locations if location.owner_company_id == grant.partner_company_id]


def create_location(db: Session, *, grant: PartnerPortalGrant, data: PartnerPortalLocationCreate) -> LocationResponse:
    """Create a partner-owned property and share it with the sole host provider."""

    _require_locations_access(db, grant)
    location_data = LocationCreate(
        name=data.name,
        address=data.address,
        city=data.city,
        postal_code=data.postal_code,
        location_type=data.location_type,
        profile=data.profile,
        access=data.access,
        spaces=data.spaces,
    )
    try:
        location = location_service.create_location_in_transaction(
            db,
            grant.partner_company_id,
            location_data.model_copy(
                update={
                    "client_id": None,
                    "owner_company_id": grant.partner_company_id,
                    "managing_company_id": grant.partner_company_id,
                    "default_service_provider_id": grant.host_company_id,
                    "department_id": None,
                    "team_id": None,
                }
            ),
            entitlement_company_id=grant.host_company_id,
        )
        db.commit()
        db.refresh(location)
    except Exception:
        db.rollback()
        raise
    return _serialize(location)


def update_location(
    db: Session,
    *,
    grant: PartnerPortalGrant,
    location_id: int,
    data: PartnerPortalLocationUpdate,
) -> LocationResponse:
    _require_locations_access(db, grant)
    require_owned_location(db, grant, location_id)
    location = location_service.update_location(
        db,
        location_id,
        LocationUpdate(**data.model_dump(exclude_unset=True)),
        grant.partner_company_id,
        entitlement_company_id=grant.host_company_id,
    )
    return _serialize(location)


def delete_location(db: Session, *, grant: PartnerPortalGrant, location_id: int) -> None:
    _require_locations_access(db, grant)
    require_owned_location(db, grant, location_id)
    location_service.delete_location(db, location_id, grant.partner_company_id, entitlement_company_id=grant.host_company_id)


def location_catalog() -> dict:
    return location_catalog_service.get_catalog()


def suggest_location_spaces(site_type: str, attributes: dict[str, object]):
    return location_catalog_service.suggest_spaces(site_type, attributes)
