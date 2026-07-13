"""normalize task checklists and assignments

Revision ID: g9b0c1d2e3f4
Revises: f8a9b0c1d2e3
"""

import re
from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "g9b0c1d2e3f4"
down_revision: str | None = "f8a9b0c1d2e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CHECKLIST_PATTERN = re.compile(
    r"^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)"
    r"(?:\s*\(@(\d+)(?::([^)]+))?\))?\s*$"
)
HIDDEN_PATTERN = re.compile(r"<!--\s*workhive_assignees:([\s\S]*?)\s*-->")
STATUSES = {"pending", "accepted", "rejected", "progress", "completed", "review"}
PRIORITY = {"pending": 0, "accepted": 1, "completed": 2, "progress": 3, "review": 4, "rejected": 5}


def _status(meta: str | None, completed: bool) -> str:
    if meta:
        parts = [part.strip() for part in meta.split(":") if part.strip()]
        if parts and parts[-1] in STATUSES:
            return parts[-1]
    return "completed" if completed else "pending"


def _hidden_ids(description: str) -> set[int]:
    values: set[int] = set()
    for match in HIDDEN_PATTERN.finditer(description):
        for raw in match.group(1).split(","):
            try:
                values.add(int(raw.strip()))
            except ValueError:
                continue
    return values


def upgrade() -> None:
    op.create_table(
        "task_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("task_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="checklist"),
        sa.UniqueConstraint("task_id", "user_id", name="uq_task_assignment_user"),
    )
    op.create_index("ix_task_assignments_task_id", "task_assignments", ["task_id"])
    op.create_index("ix_task_assignments_user_id", "task_assignments", ["user_id"])

    op.create_table(
        "task_checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("task_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("source_line_index", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("task_id", "position", name="uq_task_checklist_position"),
    )
    op.create_index("ix_task_checklist_items_task_id", "task_checklist_items", ["task_id"])

    op.create_table(
        "task_checklist_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("checklist_item_id", sa.Integer(), sa.ForeignKey("task_checklist_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.UniqueConstraint("checklist_item_id", "user_id", name="uq_task_checklist_assignment_user"),
    )
    op.create_index("ix_task_checklist_assignments_checklist_item_id", "task_checklist_assignments", ["checklist_item_id"])
    op.create_index("ix_task_checklist_assignments_user_id", "task_checklist_assignments", ["user_id"])

    bind = op.get_bind()
    metadata = sa.MetaData()
    tasks = sa.Table("task_items", metadata, autoload_with=bind)
    users = sa.Table("users", metadata, autoload_with=bind)
    task_assignments = sa.Table("task_assignments", metadata, autoload_with=bind)
    checklist_items = sa.Table("task_checklist_items", metadata, autoload_with=bind)
    checklist_assignments = sa.Table("task_checklist_assignments", metadata, autoload_with=bind)

    valid_by_company: dict[int, set[int]] = defaultdict(set)
    for user_id, company_id, is_active in bind.execute(
        sa.select(users.c.id, users.c.company_id, users.c.is_active)
    ):
        if company_id is not None and is_active:
            valid_by_company[company_id].add(user_id)

    for task in bind.execute(
        sa.select(
            tasks.c.id,
            tasks.c.company_id,
            tasks.c.user_id,
            tasks.c.status,
            tasks.c.description,
            tasks.c.checklist_evidence,
        )
    ).mappings():
        description = task["description"] or ""
        valid_ids = valid_by_company.get(task["company_id"], set())
        statuses: dict[int, list[str]] = defaultdict(list)
        explicit_ids: set[int] = set()
        evidence = dict(task["checklist_evidence"] or {})
        position = 0
        for line_index, line in enumerate(description.splitlines()):
            match = CHECKLIST_PATTERN.match(line)
            if not match:
                continue
            completed = match.group(1).lower() == "x"
            text = match.group(2).strip()
            user_id = int(match.group(3)) if match.group(3) else None
            item_id = bind.execute(
                sa.insert(checklist_items)
                .values(
                    task_id=task["id"],
                    position=position,
                    source_line_index=line_index,
                    text=text,
                    completed=completed,
                )
                .returning(checklist_items.c.id)
            ).scalar_one()
            legacy_key = f"parsed_{position + 1}"
            stable_key = f"item_{item_id}"
            if stable_key not in evidence and legacy_key in evidence:
                evidence[stable_key] = evidence[legacy_key]
            position += 1
            if user_id is not None and user_id in valid_ids:
                worker_status = _status(match.group(4), completed)
                bind.execute(
                    sa.insert(checklist_assignments).values(
                        checklist_item_id=item_id,
                        user_id=user_id,
                        status=worker_status,
                    )
                )
                statuses[user_id].append(worker_status)
                explicit_ids.add(user_id)

        aggregate: dict[int, tuple[str, str]] = {}
        for user_id in explicit_ids:
            values = statuses[user_id]
            aggregate[user_id] = (
                "completed" if values and all(value == "completed" for value in values)
                else max(values, key=lambda value: PRIORITY.get(value, 0)),
                "checklist",
            )
        for user_id in _hidden_ids(description) & valid_ids:
            aggregate.setdefault(user_id, (task["status"], "all"))
        if task["user_id"] in valid_ids:
            aggregate.setdefault(task["user_id"], (task["status"], "direct"))
        for user_id, (worker_status, source) in aggregate.items():
            bind.execute(
                sa.insert(task_assignments).values(
                    task_id=task["id"],
                    user_id=user_id,
                    status=worker_status,
                    source=source,
                )
            )
        if evidence != (task["checklist_evidence"] or {}):
            bind.execute(
                sa.update(tasks)
                .where(tasks.c.id == task["id"])
                .values(checklist_evidence=evidence)
            )


def downgrade() -> None:
    op.drop_index("ix_task_checklist_assignments_user_id", table_name="task_checklist_assignments")
    op.drop_index("ix_task_checklist_assignments_checklist_item_id", table_name="task_checklist_assignments")
    op.drop_table("task_checklist_assignments")
    op.drop_index("ix_task_checklist_items_task_id", table_name="task_checklist_items")
    op.drop_table("task_checklist_items")
    op.drop_index("ix_task_assignments_user_id", table_name="task_assignments")
    op.drop_index("ix_task_assignments_task_id", table_name="task_assignments")
    op.drop_table("task_assignments")
