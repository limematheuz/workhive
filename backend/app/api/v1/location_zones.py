from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveManagerOrAdmin, AsyncActiveUser, get_async_db, get_db
from app.models.user import User
from app.schemas.location_zone import (
    LocationZoneCreate,
    LocationZoneResponse,
    LocationZoneUpdate,
)
from app.services import location_access_service, location_zone_service


router = APIRouter()


@router.get("/{location_id}/zones", response_model=list[LocationZoneResponse])
async def read_location_zones(
    location_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        location_access_service.require_readable_location(
            sync_db,
            current_user,
            location_id,
        )
        return location_zone_service.list_zones(sync_db, location_id)

    return await db.run_sync(operation)


@router.post(
    "/{location_id}/zones",
    response_model=LocationZoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_location_zone(
    location_id: int,
    zone_data: LocationZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_zone_service.create_zone(db, location_id, zone_data)


@router.patch("/{location_id}/zones/{zone_id}", response_model=LocationZoneResponse)
def update_location_zone(
    location_id: int,
    zone_id: int,
    zone_data: LocationZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_zone_service.update_zone(db, location_id, zone_id, zone_data)


@router.delete("/{location_id}/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_location_zone(
    location_id: int,
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_zone_service.archive_zone(db, location_id, zone_id)
