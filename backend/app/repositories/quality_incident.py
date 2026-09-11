from sqlalchemy.orm import Session, selectinload

from app.models.quality_incident import QualityIncident


def list_incidents(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[QualityIncident]:
    query = (
        db.query(QualityIncident)
        .options(selectinload(QualityIncident.corrective_actions))
        .filter(QualityIncident.company_id == company_id)
    )
    if location_ids is not None:
        query = query.filter(QualityIncident.location_id.in_(location_ids))
    return query.order_by(
        QualityIncident.status.asc(), QualityIncident.created_at.desc(), QualityIncident.id.desc()
    ).all()


def get_incident(
    db: Session,
    *,
    company_id: int,
    incident_id: int,
    for_update: bool = False,
) -> QualityIncident | None:
    query = (
        db.query(QualityIncident)
        .options(selectinload(QualityIncident.corrective_actions))
        .filter(QualityIncident.company_id == company_id, QualityIncident.id == incident_id)
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()
