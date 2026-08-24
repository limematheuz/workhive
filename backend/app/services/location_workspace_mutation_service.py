from collections.abc import Callable
from typing import TypeVar

from sqlalchemy.orm import Session

from app.models.location_zone import LocationSpaceTaskTemplate, LocationZone
from app.schemas.location_workspace import (
    LocationSpaceInput,
    LocationSpaceReorderRequest,
    LocationSpaceTaskTemplateInput,
    LocationSpaceTaskTemplateUpdate,
    LocationSpaceUpdate,
)
from app.services import location_workspace_service


T = TypeVar("T")


def _commit_workspace_change(
    db: Session,
    operation: Callable[[], T],
    *,
    refresh_result: bool = False,
) -> T:
    try:
        result = operation()
        db.commit()
        if refresh_result:
            db.refresh(result)
        return result
    except Exception:
        db.rollback()
        raise


def create_space(
    db: Session,
    location_id: int,
    space_data: LocationSpaceInput,
) -> LocationZone:
    return _commit_workspace_change(
        db,
        lambda: location_workspace_service.create_space(db, location_id, space_data),
        refresh_result=True,
    )


def reorder_spaces(
    db: Session,
    location_id: int,
    request: LocationSpaceReorderRequest,
) -> None:
    _commit_workspace_change(
        db,
        lambda: location_workspace_service.reorder_spaces(
            db,
            location_id,
            request.space_ids,
        ),
    )


def update_space(
    db: Session,
    location_id: int,
    space_id: int,
    space_data: LocationSpaceUpdate,
) -> LocationZone:
    return _commit_workspace_change(
        db,
        lambda: location_workspace_service.update_space(
            db,
            location_id,
            space_id,
            space_data,
        ),
        refresh_result=True,
    )


def archive_space(db: Session, location_id: int, space_id: int) -> None:
    _commit_workspace_change(
        db,
        lambda: location_workspace_service.archive_space(db, location_id, space_id),
    )


def create_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_data: LocationSpaceTaskTemplateInput,
) -> LocationSpaceTaskTemplate:
    return _commit_workspace_change(
        db,
        lambda: location_workspace_service.create_space_task_template(
            db,
            location_id,
            space_id,
            task_data,
        ),
        refresh_result=True,
    )


def update_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_template_id: int,
    task_data: LocationSpaceTaskTemplateUpdate,
) -> LocationSpaceTaskTemplate:
    return _commit_workspace_change(
        db,
        lambda: location_workspace_service.update_space_task_template(
            db,
            location_id,
            space_id,
            task_template_id,
            task_data,
        ),
        refresh_result=True,
    )


def archive_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_template_id: int,
) -> None:
    _commit_workspace_change(
        db,
        lambda: location_workspace_service.archive_space_task_template(
            db,
            location_id,
            space_id,
            task_template_id,
        ),
    )
