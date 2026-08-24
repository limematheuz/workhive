from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location_zone import LocationZone
from app.repositories import location_zone as location_zone_repo
from app.schemas.location_zone import LocationZoneCreate, LocationZoneUpdate


def list_zones(db: Session, location_id: int) -> list[LocationZone]:
    return location_zone_repo.list_active_zones(db, location_id)


def create_zone(
    db: Session,
    location_id: int,
    zone_data: LocationZoneCreate,
) -> LocationZone:
    last_zone = location_zone_repo.list_active_zones(db, location_id)
    zone = location_zone_repo.create_zone(
        db,
        LocationZone(
            location_id=location_id,
            name=zone_data.name.strip(),
            zone_type=zone_data.zone_type,
            sort_order=(last_zone[-1].sort_order + 1) if last_zone else 0,
        ),
    )
    db.commit()
    db.refresh(zone)
    return zone


def update_zone(
    db: Session,
    location_id: int,
    zone_id: int,
    zone_data: LocationZoneUpdate,
) -> LocationZone:
    zone = location_zone_repo.get_zone(db, location_id, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location zone not found")
    for field, value in zone_data.model_dump(exclude_unset=True).items():
        setattr(zone, field, value.strip() if field == "name" else value)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def archive_zone(db: Session, location_id: int, zone_id: int) -> None:
    zone = location_zone_repo.get_zone(db, location_id, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location zone not found")
    zone.is_active = False
    db.add(zone)
    db.commit()


def validate_task_zone_ids(
    db: Session,
    location_id: int,
    zone_ids: list[int],
) -> list[LocationZone]:
    requested_ids = list(dict.fromkeys(zone_ids))
    zones = location_zone_repo.get_active_zones_by_ids(
        db,
        location_id,
        requested_ids,
    )
    if len(zones) != len(requested_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every selected zone must be active and belong to the task location",
        )
    zones_by_id = {zone.id: zone for zone in zones}
    return [zones_by_id[zone_id] for zone_id in requested_ids]


def sync_task_zones(
    db: Session,
    task_id: int,
    location_id: int,
    zone_ids: list[int],
) -> None:
    zones = validate_task_zone_ids(db, location_id, zone_ids)
    location_zone_repo.replace_task_zones(db, task_id, zones)
