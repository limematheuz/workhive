from sqlalchemy.orm import Session

from app.models.location_zone import LocationZone, TaskZone


def list_active_zones(db: Session, location_id: int) -> list[LocationZone]:
    return (
        db.query(LocationZone)
        .filter(
            LocationZone.location_id == location_id,
            LocationZone.is_active.is_(True),
        )
        .order_by(LocationZone.sort_order.asc(), LocationZone.id.asc())
        .all()
    )


def get_zone(db: Session, location_id: int, zone_id: int) -> LocationZone | None:
    return (
        db.query(LocationZone)
        .filter(
            LocationZone.id == zone_id,
            LocationZone.location_id == location_id,
        )
        .first()
    )


def get_active_zones_by_ids(
    db: Session,
    location_id: int,
    zone_ids: list[int],
) -> list[LocationZone]:
    if not zone_ids:
        return []
    return (
        db.query(LocationZone)
        .filter(
            LocationZone.location_id == location_id,
            LocationZone.is_active.is_(True),
            LocationZone.id.in_(zone_ids),
        )
        .all()
    )


def create_zone(db: Session, zone: LocationZone) -> LocationZone:
    db.add(zone)
    db.flush()
    return zone


def replace_task_zones(db: Session, task_id: int, zones: list[LocationZone]) -> None:
    db.query(TaskZone).filter(TaskZone.task_id == task_id).delete(
        synchronize_session=False
    )
    db.add_all(
        [
            TaskZone(
                task_id=task_id,
                zone_id=zone.id,
                zone_name=zone.name,
                zone_type=zone.zone_type,
            )
            for zone in zones
        ]
    )
    db.flush()
