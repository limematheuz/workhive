from fastapi import HTTPException,status
from sqlalchemy.orm import Session
from app.repositories import template_task as template_task_repo,service_catalog_version as service_catalog_version_repo


def _resolve_current_catalog_version_id(
    db: Session,
    *,
    template_task_id: int,
    company_id: int | None,
) -> int:
    """Resolve an active service in the caller's company to its immutable revision."""
    template = template_task_repo.get_template_task_by_id(
        db,
        template_task_id,
        company_id,
    )
    if not template or not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service catalog entry not found",
        )

    version = service_catalog_version_repo.get_current_for_template(
        db,
        template_task_id=template.id,
        version=template.catalog_version,
    )
    # The migration creates this record for every legacy template. Keeping this
    # repair path protects a partially migrated local database without ever
    # altering an existing immutable version.
    if version is None:
        version = service_catalog_version_repo.create_from_template(db, template)
    return version.id
