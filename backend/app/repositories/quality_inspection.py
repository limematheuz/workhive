from sqlalchemy.orm import Session, selectinload

from app.models.quality_inspection import QualityInspection


def list_inspections(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[QualityInspection]:
    query = (
        db.query(QualityInspection)
        .options(selectinload(QualityInspection.items))
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
        .options(selectinload(QualityInspection.items))
        .filter(
            QualityInspection.company_id == company_id,
            QualityInspection.id == inspection_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()
