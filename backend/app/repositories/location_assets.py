from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.location_document import LocationDocument
from app.models.location_equipment import LocationEquipment
from app.models.location import Location


def list_documents(db: Session, location_id: int) -> list[LocationDocument]:
    return (
        db.query(LocationDocument)
        .filter(LocationDocument.location_id == location_id, LocationDocument.archived_at.is_(None))
        .order_by(LocationDocument.created_at.desc(), LocationDocument.id.desc())
        .all()
    )


def active_document_bytes_for_company(db: Session, company_id: int) -> int:
    """Return active document usage. Caller owns any required quota lock."""

    return int(
        db.query(func.coalesce(func.sum(LocationDocument.size_bytes), 0))
        .filter(
            LocationDocument.company_id == company_id,
            LocationDocument.archived_at.is_(None),
        )
        .scalar()
        or 0
    )


def list_documents_for_locations(
    db: Session, location_ids: set[int]
) -> list[tuple[LocationDocument, str]]:
    if not location_ids:
        return []
    return (
        db.query(LocationDocument, Location.name)
        .join(Location, Location.id == LocationDocument.location_id)
        .filter(
            LocationDocument.location_id.in_(location_ids),
            LocationDocument.archived_at.is_(None),
        )
        .order_by(LocationDocument.created_at.desc(), LocationDocument.id.desc())
        .all()
    )


def get_document(db: Session, location_id: int, document_id: int) -> LocationDocument | None:
    return (
        db.query(LocationDocument)
        .filter(LocationDocument.location_id == location_id, LocationDocument.id == document_id, LocationDocument.archived_at.is_(None))
        .first()
    )


def list_equipment(db: Session, location_id: int) -> list[LocationEquipment]:
    return (
        db.query(LocationEquipment)
        .filter(LocationEquipment.location_id == location_id, LocationEquipment.is_active.is_(True))
        .order_by(LocationEquipment.name.asc(), LocationEquipment.id.asc())
        .all()
    )


def list_equipment_for_locations(
    db: Session, location_ids: set[int]
) -> list[tuple[LocationEquipment, str]]:
    if not location_ids:
        return []
    return (
        db.query(LocationEquipment, Location.name)
        .join(Location, Location.id == LocationEquipment.location_id)
        .filter(
            LocationEquipment.location_id.in_(location_ids),
            LocationEquipment.is_active.is_(True),
        )
        .order_by(Location.name.asc(), LocationEquipment.name.asc(), LocationEquipment.id.asc())
        .all()
    )


def get_equipment(db: Session, location_id: int, equipment_id: int) -> LocationEquipment | None:
    return (
        db.query(LocationEquipment)
        .filter(LocationEquipment.location_id == location_id, LocationEquipment.id == equipment_id, LocationEquipment.is_active.is_(True))
        .first()
    )
