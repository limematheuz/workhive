from sqlalchemy.orm import Session

from app.models.service_catalog_version import ServiceCatalogVersion
from app.models.template_task import TemplateTask


def create_from_template(db: Session, template: TemplateTask) -> ServiceCatalogVersion:
    version = ServiceCatalogVersion(
        template_task_id=template.id,
        version=template.catalog_version,
        name=template.name,
        description=template.description,
        default_price=template.default_price,
        unit=template.unit,
        pricing_mode=template.pricing_mode,
        estimated_duration_minutes=template.estimated_duration_minutes,
        requirements=template.requirements,
    )
    db.add(version)
    db.flush()
    return version


def list_for_template(
    db: Session,
    *,
    template_task_id: int,
) -> list[ServiceCatalogVersion]:
    return (
        db.query(ServiceCatalogVersion)
        .filter(ServiceCatalogVersion.template_task_id == template_task_id)
        .order_by(ServiceCatalogVersion.version.desc())
        .all()
    )


def get_current_for_template(
    db: Session,
    *,
    template_task_id: int,
    version: int,
) -> ServiceCatalogVersion | None:
    return (
        db.query(ServiceCatalogVersion)
        .filter(
            ServiceCatalogVersion.template_task_id == template_task_id,
            ServiceCatalogVersion.version == version,
        )
        .one_or_none()
    )
