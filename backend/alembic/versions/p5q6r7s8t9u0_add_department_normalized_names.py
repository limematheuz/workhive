"""add normalized department names

Revision ID: p5q6r7s8t9u0
Revises: o4p5q6r7s8t9
"""

import unicodedata

from alembic import op
import sqlalchemy as sa


revision = "p5q6r7s8t9u0"
down_revision = "o4p5q6r7s8t9"
branch_labels = None
depends_on = None


def normalize_department_name(name: str) -> str:
    collapsed = " ".join(name.split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        character
        for character in decomposed
        if unicodedata.category(character) != "Mn"
    )
    return without_accents.casefold()


def _normalized_rows(bind: sa.Connection) -> list[tuple[int, str]]:
    rows = bind.execute(sa.text("SELECT id, company_id, name FROM departments")).mappings()
    normalized_rows: list[tuple[int, str]] = []
    seen_names: set[tuple[int, str]] = set()
    for row in rows:
        normalized_name = normalize_department_name(row["name"])
        if not normalized_name:
            raise RuntimeError(
                "Cannot migrate departments with a blank normalized name; correct the existing data before retrying"
            )
        uniqueness_key = (row["company_id"], normalized_name)
        if uniqueness_key in seen_names:
            raise RuntimeError(
                "Cannot migrate duplicate department names after normalization; correct the existing data before retrying"
            )
        seen_names.add(uniqueness_key)
        normalized_rows.append((row["id"], normalized_name))
    return normalized_rows


def upgrade() -> None:
    bind = op.get_bind()
    normalized_rows = _normalized_rows(bind)
    op.add_column(
        "departments",
        sa.Column("normalized_name", sa.String(length=120), nullable=True),
    )
    departments = sa.table(
        "departments",
        sa.column("id", sa.Integer),
        sa.column("normalized_name", sa.String(length=120)),
    )
    for department_id, normalized_name in normalized_rows:
        bind.execute(
            sa.update(departments)
            .where(departments.c.id == department_id)
            .values(normalized_name=normalized_name)
        )

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("departments") as batch:
            batch.alter_column("normalized_name", nullable=False)
            batch.create_unique_constraint(
                "uq_department_company_normalized_name",
                ["company_id", "normalized_name"],
            )
    else:
        op.alter_column(
            "departments",
            "normalized_name",
            existing_type=sa.String(length=120),
            nullable=False,
        )
        op.create_unique_constraint(
            "uq_department_company_normalized_name",
            "departments",
            ["company_id", "normalized_name"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("departments") as batch:
            batch.drop_constraint("uq_department_company_normalized_name", type_="unique")
            batch.drop_column("normalized_name")
    else:
        op.drop_constraint(
            "uq_department_company_normalized_name",
            "departments",
            type_="unique",
        )
        op.drop_column("departments", "normalized_name")
