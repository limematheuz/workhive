from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from app.models.location import Location
from app.models.client import Client
from app.models.location_company_access import LocationCompanyAccess
from app.schemas.location import LocationCreate, LocationUpdate


def get_location_by_id(
    db: Session, location_id: int, company_id: int | None
) -> Location | None:
    query = db.query(Location).options(
        selectinload(Location.client),
        selectinload(Location.company_access),
    )
    if company_id is not None:
        query = query.outerjoin(Client).filter(
            or_(
                Client.company_id == company_id,
                Location.owner_company_id == company_id,
                Location.managing_company_id == company_id,
                Location.company_access.any(
                    LocationCompanyAccess.company_id == company_id
                ),
            )
        )
    return query.filter(Location.id == location_id).first()


def get_locations_by_client(
    db: Session,
    company_id: int | None,
    client_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Location]:
    query = db.query(Location).options(
        selectinload(Location.client),
        selectinload(Location.company_access),
    )
    if company_id is not None:
        query = query.outerjoin(Client).filter(
            or_(
                Client.company_id == company_id,
                Location.owner_company_id == company_id,
                Location.managing_company_id == company_id,
                Location.company_access.any(
                    LocationCompanyAccess.company_id == company_id
                ),
            )
        )
    query = query.filter(Location.is_active.is_(True))

    if client_id is not None:
        query = query.filter(Location.client_id == client_id)

    return query.offset(skip).limit(limit).all()


def create_location(db: Session, location_data: LocationCreate) -> Location:
    dump = location_data.model_dump()
    db_location = Location(**dump)
    db.add(db_location)
    db.flush()
    return db_location


def update_location(
    db: Session, db_location: Location, location_data: LocationUpdate
) -> Location:
    update_data = location_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_location, key, value)

    db.add(db_location)
    db.flush()
    return db_location


def delete_location(db: Session, db_location: Location) -> Location:
    db_location.is_active = False
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location
