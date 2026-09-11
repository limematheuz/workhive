from sqlalchemy.orm import Session, selectinload

from app.models.quality_template import QualityInspectionTemplate


def list_templates(
    db: Session,
    *,
    company_id: int,
    location_ids: set[int] | None,
) -> list[QualityInspectionTemplate]:
    query = (
        db.query(QualityInspectionTemplate)
        .options(selectinload(QualityInspectionTemplate.items))
        .filter(QualityInspectionTemplate.company_id == company_id)
    )
    if location_ids is not None:
        query = query.filter(QualityInspectionTemplate.location_id.in_(location_ids))
    return query.order_by(
        QualityInspectionTemplate.is_active.desc(),
        QualityInspectionTemplate.title.asc(),
        QualityInspectionTemplate.id.asc(),
    ).all()


def get_template(
    db: Session,
    *,
    company_id: int,
    template_id: int,
    for_update: bool = False,
) -> QualityInspectionTemplate | None:
    query = (
        db.query(QualityInspectionTemplate)
        .options(selectinload(QualityInspectionTemplate.items))
        .filter(
            QualityInspectionTemplate.company_id == company_id,
            QualityInspectionTemplate.id == template_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()
