from sqlalchemy.orm import Session

from app.models.location_company_access import LocationCompanyAccess
from app.schemas.location_company_access import (
    LocationCompanyAccessCreate,
    LocationCompanyAccessUpdate,
)


def get_access(
    db: Session, location_id: int, company_id: int
) -> LocationCompanyAccess | None:
    return (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location_id,
            LocationCompanyAccess.company_id == company_id,
        )
        .first()
    )


def list_access(db: Session, location_id: int) -> list[LocationCompanyAccess]:
    return (
        db.query(LocationCompanyAccess)
        .filter(LocationCompanyAccess.location_id == location_id)
        .all()
    )


def create_access(
    db: Session, location_id: int, data: LocationCompanyAccessCreate
) -> LocationCompanyAccess:
    access = LocationCompanyAccess(location_id=location_id, **data.model_dump())
    db.add(access)
    db.commit()
    db.refresh(access)
    return access


def update_access(
    db: Session, access: LocationCompanyAccess, data: LocationCompanyAccessUpdate
) -> LocationCompanyAccess:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(access, key, value)
    db.add(access)
    db.commit()
    db.refresh(access)
    return access


def delete_access(db: Session, access: LocationCompanyAccess) -> None:
    db.delete(access)
