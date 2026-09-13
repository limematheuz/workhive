"""make notification deduplication durable

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
"""

import json

import sqlalchemy as sa
from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def _dedupe_key(metadata: object) -> str | None:
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            return None
    if not isinstance(metadata, dict):
        return None
    value = metadata.get("dedupe_key")
    return value if isinstance(value, str) and value else None


def upgrade() -> None:
    with op.batch_alter_table("notifications") as batch:
        batch.add_column(sa.Column("dedupe_key", sa.String(length=200), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, user_id, event_type, entity_type, entity_id, metadata_json
            FROM notifications
            ORDER BY id
            """
        )
    ).mappings()
    seen: set[tuple[object, ...]] = set()
    for row in rows:
        dedupe_key = _dedupe_key(row["metadata_json"])
        identity = (
            row["user_id"],
            row["event_type"],
            row["entity_type"],
            row["entity_id"],
            dedupe_key,
        )
        if dedupe_key is None or identity in seen:
            continue
        connection.execute(
            sa.text("UPDATE notifications SET dedupe_key = :dedupe_key WHERE id = :id"),
            {"dedupe_key": dedupe_key, "id": row["id"]},
        )
        seen.add(identity)

    with op.batch_alter_table("notifications") as batch:
        batch.create_unique_constraint(
            "uq_notification_user_event_entity_dedupe",
            ["user_id", "event_type", "entity_type", "entity_id", "dedupe_key"],
        )


def downgrade() -> None:
    with op.batch_alter_table("notifications") as batch:
        batch.drop_constraint("uq_notification_user_event_entity_dedupe", type_="unique")
        batch.drop_column("dedupe_key")
