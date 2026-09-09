from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_service_window import LocationServiceWindow
from app.repositories import location_workspace as workspace_repo
from app.schemas.location_workspace import LocationServiceWindowInput


def sync_service_windows(
    db: Session,
    location: Location,
    service_windows: list[LocationServiceWindowInput] | None,
) -> None:
    """Replace the explicit schedule windows for this location only."""
    if service_windows is None:
        return
    if len(service_windows) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A location can contain at most 50 service windows",
        )

    existing = {
        service_window.id: service_window
        for service_window in workspace_repo.list_service_windows(db, location.id)
    }
    requested_ids = {
        service_window.id
        for service_window in service_windows
        if service_window.id is not None
    }
    if not requested_ids.issubset(existing):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location service window not found",
        )

    for service_window in service_windows:
        values = service_window.model_dump(exclude={"id"})
        if service_window.id is None:
            db.add(LocationServiceWindow(location_id=location.id, **values))
            continue
        persisted = existing[service_window.id]
        for field, value in values.items():
            setattr(persisted, field, value)
        db.add(persisted)

    for service_window_id, persisted in existing.items():
        if service_window_id not in requested_ids:
            db.delete(persisted)
    db.flush()
