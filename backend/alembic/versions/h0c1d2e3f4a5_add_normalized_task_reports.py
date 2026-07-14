"""add normalized immutable task reports

Revision ID: h0c1d2e3f4a5
Revises: g9b0c1d2e3f4
"""

from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op


revision: str = "h0c1d2e3f4a5"
down_revision: str | None = "g9b0c1d2e3f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MEDIA_PREFIX = "/api/v1/uploads/media/"


def _text(value, limit: int) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[:limit]


def _media_key(value) -> str | None:
    if not isinstance(value, str) or not value.startswith(MEDIA_PREFIX):
        return None
    key = value.removeprefix(MEDIA_PREFIX)
    if not key or key.startswith("/") or ".." in key.split("/"):
        return None
    return key[:500]


def _created_at(value) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _insert_report(bind, reports, values: dict) -> None:
    bind.execute(reports.insert().values(**values))


def _backfill() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    tasks = sa.Table("task_items", metadata, autoload_with=bind)
    reservations = sa.Table("reservations", metadata, autoload_with=bind)
    checklist_items = sa.Table("task_checklist_items", metadata, autoload_with=bind)
    reports = sa.Table("task_reports", metadata, autoload_with=bind)

    requester_by_reservation = dict(
        bind.execute(
            sa.select(reservations.c.id, reservations.c.owner_company_id)
        ).all()
    )
    checklist_by_task: dict[int, dict[str, tuple[int, str]]] = {}
    for item in bind.execute(
        sa.select(
            checklist_items.c.task_id,
            checklist_items.c.id,
            checklist_items.c.position,
            checklist_items.c.text,
        )
    ).mappings():
        task_checklist = checklist_by_task.setdefault(item["task_id"], {})
        value = (item["id"], item["text"])
        task_checklist[f"item_{item['id']}"] = value
        task_checklist[f"parsed_{item['position'] + 1}"] = value

    for task in bind.execute(
        sa.select(
            tasks.c.id,
            tasks.c.company_id,
            tasks.c.checkout_reservation_id,
            tasks.c.operational_notes,
            tasks.c.attachments,
            tasks.c.reported_issues,
            tasks.c.checklist_evidence,
        )
    ).mappings():
        base = {
            "task_item_id": task["id"],
            "reporter_user_id": None,
            "reporter_company_id": task["company_id"],
            "requesting_company_id": requester_by_reservation.get(
                task["checkout_reservation_id"]
            ),
            "reporter_name": "Histórico",
        }
        for index, note in enumerate(task["operational_notes"] or []):
            if not isinstance(note, dict) or not _text(note.get("text"), 4000):
                continue
            values = {
                **base,
                "client_event_id": f"legacy:{task['id']}:note:{index}",
                "report_type": "note",
                "description": _text(note.get("text"), 4000),
                "reporter_name": _text(note.get("author"), 255) or "Histórico",
            }
            if created_at := _created_at(note.get("date")):
                values["created_at"] = created_at
            _insert_report(
                bind,
                reports,
                values,
            )
        for index, attachment in enumerate(task["attachments"] or []):
            if not isinstance(attachment, dict):
                continue
            key = _media_key(attachment.get("url"))
            if not key:
                continue
            values = {
                **base,
                "client_event_id": f"legacy:{task['id']}:photo:{index}",
                "report_type": "photo",
                "media_key": key,
                "file_name": _text(attachment.get("name"), 255),
            }
            if created_at := _created_at(attachment.get("date")):
                values["created_at"] = created_at
            _insert_report(
                bind,
                reports,
                values,
            )
        for index, issue in enumerate(task["reported_issues"] or []):
            if not isinstance(issue, dict):
                continue
            title = _text(issue.get("title"), 160)
            if not title:
                continue
            values = {
                **base,
                "client_event_id": f"legacy:{task['id']}:issue:{index}",
                "report_type": "issue",
                "title": title,
                "description": _text(issue.get("description"), 4000),
                "issue_type": _text(issue.get("type"), 80),
                "element": _text(issue.get("element"), 80),
                "media_key": _media_key(issue.get("photoUrl")),
            }
            if created_at := _created_at(issue.get("createdAt")):
                values["created_at"] = created_at
            _insert_report(
                bind,
                reports,
                values,
            )
        migrated_checklist_values: set[tuple] = set()
        for evidence_key, evidence in (task["checklist_evidence"] or {}).items():
            if not isinstance(evidence, dict):
                continue
            checklist = checklist_by_task.get(task["id"], {}).get(str(evidence_key))
            if not checklist:
                continue
            checklist_id, label = checklist
            evidence_suffix = str(evidence_key).replace(":", "-")[:20]
            note = _text(evidence.get("note"), 4000)
            note_identity = (checklist_id, "note", note)
            if note and note_identity not in migrated_checklist_values:
                migrated_checklist_values.add(note_identity)
                _insert_report(
                    bind,
                    reports,
                    {
                        **base,
                        "client_event_id": f"legacy:{task['id']}:checklist-note:{evidence_suffix}",
                        "report_type": "checklist_note",
                        "description": note,
                        "checklist_item_id": checklist_id,
                        "checklist_item_label": label[:500],
                    },
                )
            media_key = _media_key(evidence.get("photoUrl"))
            photo_identity = (checklist_id, "photo", media_key)
            if media_key and photo_identity not in migrated_checklist_values:
                migrated_checklist_values.add(photo_identity)
                _insert_report(
                    bind,
                    reports,
                    {
                        **base,
                        "client_event_id": f"legacy:{task['id']}:checklist-photo:{evidence_suffix}",
                        "report_type": "checklist_photo",
                        "media_key": media_key,
                        "file_name": _text(evidence.get("photoName"), 255),
                        "checklist_item_id": checklist_id,
                        "checklist_item_label": label[:500],
                    },
                )


def upgrade() -> None:
    op.create_table(
        "task_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_item_id", sa.Integer(), sa.ForeignKey("task_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reporter_company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requesting_company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("checklist_item_id", sa.Integer(), sa.ForeignKey("task_checklist_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_event_id", sa.String(length=64), nullable=False),
        sa.Column("report_type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("issue_type", sa.String(length=80), nullable=True),
        sa.Column("element", sa.String(length=80), nullable=True),
        sa.Column("media_key", sa.String(length=500), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("reporter_name", sa.String(length=255), nullable=False),
        sa.Column("checklist_item_label", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "report_type IN ('issue', 'note', 'photo', 'checklist_note', 'checklist_photo')",
            name="ck_task_reports_type",
        ),
        sa.UniqueConstraint("reporter_user_id", "client_event_id", name="uq_task_report_user_event"),
    )
    for column in (
        "task_item_id",
        "reporter_user_id",
        "reporter_company_id",
        "requesting_company_id",
        "checklist_item_id",
        "report_type",
        "created_at",
    ):
        op.create_index(f"ix_task_reports_{column}", "task_reports", [column])
    _backfill()


def downgrade() -> None:
    op.drop_table("task_reports")
