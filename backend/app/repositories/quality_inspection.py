from sqlalchemy.orm import Session, selectinload

from app.models.location import Location
from app.models.quality_inspection import QualityInspection


def list_inspections(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[QualityInspection]:
    query = (
        db.query(QualityInspection)
        .options(
            selectinload(QualityInspection.conformity),
            selectinload(QualityInspection.client_acceptance),
            selectinload(QualityInspection.items),
            selectinload(QualityInspection.evidence),
        )
        .filter(QualityInspection.company_id == company_id)
    )
    if location_ids is not None:
        query = query.filter(QualityInspection.location_id.in_(location_ids))
    return query.order_by(
        QualityInspection.created_at.desc(), QualityInspection.id.desc()
    ).all()


def get_inspection(
    db: Session,
    *,
    company_id: int,
    inspection_id: int,
    for_update: bool = False,
) -> QualityInspection | None:
    query = (
        db.query(QualityInspection)
        .options(
            selectinload(QualityInspection.conformity),
            selectinload(QualityInspection.client_acceptance),
            selectinload(QualityInspection.items),
            selectinload(QualityInspection.evidence),
        )
        .filter(
            QualityInspection.company_id == company_id,
            QualityInspection.id == inspection_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def list_completed_for_client_portal(
    db: Session,
    *,
    company_id: int,
    client_id: int,
) -> list[QualityInspection]:
    return (
        db.query(QualityInspection)
        .join(Location, QualityInspection.location_id == Location.id)
        .options(
            selectinload(QualityInspection.location),
            selectinload(QualityInspection.client_acceptance),
            selectinload(QualityInspection.items),
        )
        .filter(
            QualityInspection.company_id == company_id,
            QualityInspection.status == "completed",
            Location.managing_company_id == company_id,
            Location.client_id == client_id,
        )
        .order_by(QualityInspection.completed_at.desc(), QualityInspection.id.desc())
        .all()
    )


def get_completed_for_client_portal(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    inspection_id: int,
    for_update: bool = False,
) -> QualityInspection | None:
    query = (
        db.query(QualityInspection)
        .join(Location, QualityInspection.location_id == Location.id)
        .options(
            selectinload(QualityInspection.location),
            selectinload(QualityInspection.client_acceptance),
            selectinload(QualityInspection.items),
        )
        .filter(
            QualityInspection.id == inspection_id,
            QualityInspection.company_id == company_id,
            QualityInspection.status == "completed",
            Location.managing_company_id == company_id,
            Location.client_id == client_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()
