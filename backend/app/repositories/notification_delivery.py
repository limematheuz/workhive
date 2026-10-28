"""Atomic insertion of a deduplicated notification."""

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.notification import Notification


def insert_once(db: Session, *, values: dict) -> bool:
    insert = (
        postgresql_insert
        if db.get_bind().dialect.name == "postgresql"
        else sqlite_insert
    )
    statement = (
        insert(Notification)
        .values(**values)
        .on_conflict_do_nothing(
            index_elements=[
                "user_id",
                "event_type",
                "entity_type",
                "entity_id",
                "dedupe_key",
            ]
        )
        .returning(Notification.id)
    )
    # Drivers may report rowcount=-1 for INSERT. RETURNING distinguishes an
    # actual insertion from a uniqueness conflict without a preceding query.
    return db.scalar(statement) is not None
