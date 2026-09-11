from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_contact import LocationContact
from app.repositories import location_workspace as workspace_repo
from app.schemas.location_workspace import LocationContactInput


def sync_contacts(
    db: Session,
    location: Location,
    contacts: list[LocationContactInput] | None,
) -> None:
    """Replace explicit operational contacts while keeping other location data intact."""
    if contacts is None:
        return
    if len(contacts) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A location can contain at most 50 operational contacts",
        )
    primary_contacts = [contact for contact in contacts if contact.is_primary]
    if len(primary_contacts) > 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A location can only have one primary operational contact",
        )

    existing_contacts = {
        contact.id: contact
        for contact in workspace_repo.list_contacts(db, location.id)
    }
    requested_ids = {contact.id for contact in contacts if contact.id is not None}
    if not requested_ids.issubset(existing_contacts):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location contact not found",
        )

    for contact in contacts:
        values = contact.model_dump(exclude={"id"})
        if contact.id is None:
            db.add(LocationContact(location_id=location.id, **values))
            continue
        persisted = existing_contacts[contact.id]
        for field, value in values.items():
            setattr(persisted, field, value)
        db.add(persisted)

    for contact_id, persisted in existing_contacts.items():
        if contact_id not in requested_ids:
            db.delete(persisted)
    db.flush()
