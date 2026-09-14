from sqlalchemy.orm import Session, selectinload

from app.models.location import Location
from app.models.quality_complaint import QualityComplaint


def list_complaints(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[QualityComplaint]:
    query = (
        db.query(QualityComplaint)
        .options(selectinload(QualityComplaint.location))
        .filter(QualityComplaint.company_id == company_id)
    )
    if location_ids is not None:
        query = query.filter(QualityComplaint.location_id.in_(location_ids))
    return query.order_by(
        QualityComplaint.status.asc(), QualityComplaint.created_at.desc(), QualityComplaint.id.desc()
    ).all()


def get_complaint(
    db: Session,
    *,
    company_id: int,
    complaint_id: int,
    for_update: bool = False,
) -> QualityComplaint | None:
    query = (
        db.query(QualityComplaint)
        .options(selectinload(QualityComplaint.location))
        .filter(QualityComplaint.company_id == company_id, QualityComplaint.id == complaint_id)
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def list_for_client_portal(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> list[QualityComplaint]:
    return (
        db.query(QualityComplaint)
        .join(Location, QualityComplaint.location_id == Location.id)
        .options(selectinload(QualityComplaint.location))
        .filter(
            QualityComplaint.company_id == company_id,
            QualityComplaint.client_id == client_id,
            Location.managing_company_id == company_id,
            Location.client_id == client_id,
        )
        .order_by(QualityComplaint.created_at.desc(), QualityComplaint.id.desc())
        .all()
    )


def get_location_for_client_portal(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    location_id: int,
) -> Location | None:
    return (
        db.query(Location)
        .filter(
            Location.id == location_id,
            Location.is_active.is_(True),
            Location.managing_company_id == company_id,
            Location.client_id == client_id,
        )
        .one_or_none()
    )


def list_locations_for_client_portal(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> list[Location]:
    return (
        db.query(Location)
        .filter(
            Location.is_active.is_(True),
            Location.managing_company_id == company_id,
            Location.client_id == client_id,
        )
        .order_by(Location.name.asc(), Location.id.asc())
        .all()
    )
