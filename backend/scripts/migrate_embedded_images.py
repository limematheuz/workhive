"""Move legacy base64 images from database fields into object storage."""

from collections.abc import Callable

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.invoice import Invoice
from app.models.location import Location
from app.models.quote import Quote
from app.models.task_item import TaskItem
from app.models.user import User
from app.services.image_service import store_image_data_url


def _migrate_value(
    value,
    *,
    company_id: int,
    folder: str,
) -> tuple[object, int]:
    if isinstance(value, str):
        migrated = store_image_data_url(
            value,
            company_id=company_id,
            folder=folder,
        )
        return migrated, int(migrated != value)
    if isinstance(value, list):
        migrated_items = []
        changed = 0
        for item in value:
            migrated, item_changed = _migrate_value(
                item,
                company_id=company_id,
                folder=folder,
            )
            migrated_items.append(migrated)
            changed += item_changed
        return migrated_items, changed
    if isinstance(value, dict):
        migrated_items = {}
        changed = 0
        for key, item in value.items():
            migrated, item_changed = _migrate_value(
                item,
                company_id=company_id,
                folder=folder,
            )
            migrated_items[key] = migrated
            changed += item_changed
        return migrated_items, changed
    return value, 0


def _migrate_scalar_rows(
    rows: list,
    *,
    company_id_for: Callable[[object], int | None],
    attribute: str,
    folder: str,
) -> int:
    changed = 0
    for row in rows:
        company_id = company_id_for(row)
        value = getattr(row, attribute)
        if company_id is None or not isinstance(value, str):
            continue
        migrated, item_changed = _migrate_value(
            value,
            company_id=company_id,
            folder=folder,
        )
        if item_changed:
            setattr(row, attribute, migrated)
            changed += item_changed
    return changed


def migrate() -> int:
    db = SessionLocal()
    try:
        changed = 0
        changed += _migrate_scalar_rows(
            db.query(Company).all(),
            company_id_for=lambda company: company.id,
            attribute="logo",
            folder="company",
        )
        changed += _migrate_scalar_rows(
            db.query(User).all(),
            company_id_for=lambda user: user.company_id,
            attribute="photo_url",
            folder="profile",
        )
        changed += _migrate_scalar_rows(
            db.query(Location).all(),
            company_id_for=lambda location: (
                location.owner_company_id or location.managing_company_id
            ),
            attribute="photo_url",
            folder="location",
        )
        changed += _migrate_scalar_rows(
            db.query(Invoice).all(),
            company_id_for=lambda invoice: invoice.company_id,
            attribute="signature_url",
            folder="signature",
        )
        changed += _migrate_scalar_rows(
            db.query(Quote).all(),
            company_id_for=lambda quote: quote.company_id,
            attribute="signature_url",
            folder="signature",
        )

        for task in db.query(TaskItem).all():
            operational_notes, operational_note_changes = _migrate_value(
                task.operational_notes,
                company_id=task.company_id,
                folder="location",
            )
            attachments, attachment_changes = _migrate_value(
                task.attachments,
                company_id=task.company_id,
                folder="location",
            )
            evidence, evidence_changes = _migrate_value(
                task.checklist_evidence,
                company_id=task.company_id,
                folder="location",
            )
            if operational_note_changes:
                task.operational_notes = operational_notes
            if attachment_changes:
                task.attachments = attachments
            if evidence_changes:
                task.checklist_evidence = evidence
            changed += (
                operational_note_changes
                + attachment_changes
                + evidence_changes
            )

        db.commit()
        return changed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Migrated {migrate()} embedded image value(s).")
