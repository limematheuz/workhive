from sqlalchemy.orm import Session, selectinload

from app.models.location_profile import LocationProfile
from app.models.location_contact import LocationContact
from app.models.location_risk import LocationRisk
from app.models.location_service_window import LocationServiceWindow
from app.models.location_access_profile import LocationAccessProfile
from app.models.location_zone import LocationSpaceTaskTemplate, LocationZone


def get_profile(db: Session, location_id: int) -> LocationProfile | None:
    return db.get(LocationProfile, location_id)


def get_access_profile(db: Session, location_id: int) -> LocationAccessProfile | None:
    return db.get(LocationAccessProfile, location_id)


def list_contacts(db: Session, location_id: int) -> list[LocationContact]:
    return (
        db.query(LocationContact)
        .filter(LocationContact.location_id == location_id)
        .order_by(LocationContact.is_primary.desc(), LocationContact.full_name, LocationContact.id)
        .all()
    )


def list_risks(db: Session, location_id: int) -> list[LocationRisk]:
    return (
        db.query(LocationRisk)
        .filter(LocationRisk.location_id == location_id)
        .order_by(LocationRisk.status, LocationRisk.severity.desc(), LocationRisk.title, LocationRisk.id)
        .all()
    )


def list_service_windows(db: Session, location_id: int) -> list[LocationServiceWindow]:
    return (
        db.query(LocationServiceWindow)
        .filter(LocationServiceWindow.location_id == location_id)
        .order_by(LocationServiceWindow.id)
        .all()
    )


def get_space(db: Session, location_id: int, space_id: int) -> LocationZone | None:
    return (
        db.query(LocationZone)
        .options(selectinload(LocationZone.task_templates))
        .filter(LocationZone.location_id == location_id, LocationZone.id == space_id)
        .first()
    )


def list_spaces(db: Session, location_id: int, *, active_only: bool = True) -> list[LocationZone]:
    query = (
        db.query(LocationZone)
        .options(selectinload(LocationZone.task_templates))
        .filter(LocationZone.location_id == location_id)
    )
    if active_only:
        query = query.filter(LocationZone.is_active.is_(True))
    return query.order_by(LocationZone.sort_order, LocationZone.id).all()


def get_active_space_tasks_by_ids(
    db: Session,
    location_id: int,
    task_ids: list[int],
) -> list[LocationSpaceTaskTemplate]:
    if not task_ids:
        return []
    return (
        db.query(LocationSpaceTaskTemplate)
        .join(LocationZone)
        .filter(
            LocationZone.location_id == location_id,
            LocationZone.is_active.is_(True),
            LocationSpaceTaskTemplate.is_active.is_(True),
            LocationSpaceTaskTemplate.id.in_(task_ids),
        )
        .order_by(LocationSpaceTaskTemplate.sort_order, LocationSpaceTaskTemplate.id)
        .all()
    )
