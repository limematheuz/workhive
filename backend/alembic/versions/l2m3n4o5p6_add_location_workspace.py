"""add location profiles, spaces, and reusable space tasks

Revision ID: l2m3n4o5p6
Revises: k1l2m3n4o5p6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "l2m3n4o5p6"
down_revision: str | None = "k1l2m3n4o5p6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "location_profiles",
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("site_type", sa.String(length=50), nullable=False, server_default="other"),
        sa.Column("internal_code", sa.String(length=80), nullable=True),
        sa.Column("site_reference", sa.String(length=120), nullable=True),
        sa.Column("contact_name", sa.String(length=120), nullable=True),
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
        sa.Column("contact_email", sa.String(length=254), nullable=True),
        sa.Column("service_notes", sa.Text(), nullable=True),
        sa.Column("attributes", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "company_id",
            "internal_code",
            name="uq_location_profiles_company_internal_code",
        ),
    )
    op.create_index("ix_location_profiles_company_id", "location_profiles", ["company_id"])
    op.alter_column("location_profiles", "site_type", server_default=None)
    op.alter_column("location_profiles", "attributes", server_default=None)

    op.add_column(
        "location_zones",
        sa.Column("parent_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_location_zones_parent_id",
        "location_zones",
        "location_zones",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_location_zones_parent_id", "location_zones", ["parent_id"])
    op.add_column(
        "location_zones",
        sa.Column("attributes", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.alter_column("location_zones", "attributes", server_default=None)

    op.create_table(
        "location_space_task_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "location_space_id",
            sa.Integer(),
            sa.ForeignKey("location_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="cleaning"),
        sa.Column("frequency", sa.String(length=30), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_location_space_task_templates_location_space_id",
        "location_space_task_templates",
        ["location_space_id"],
    )
    op.alter_column("location_space_task_templates", "category", server_default=None)
    op.alter_column("location_space_task_templates", "sort_order", server_default=None)
    op.alter_column("location_space_task_templates", "is_active", server_default=None)

    op.add_column(
        "task_checklist_items",
        sa.Column("location_space_task_template_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_task_checklist_items_location_space_task_template",
        "task_checklist_items",
        "location_space_task_templates",
        ["location_space_task_template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_task_checklist_items_location_space_task_template_id",
        "task_checklist_items",
        ["location_space_task_template_id"],
    )
    op.add_column(
        "task_checklist_items",
        sa.Column("space_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("task_checklist_items", "space_name")
    op.drop_index(
        "ix_task_checklist_items_location_space_task_template_id",
        table_name="task_checklist_items",
    )
    op.drop_constraint(
        "fk_task_checklist_items_location_space_task_template",
        "task_checklist_items",
        type_="foreignkey",
    )
    op.drop_column("task_checklist_items", "location_space_task_template_id")

    op.drop_index(
        "ix_location_space_task_templates_location_space_id",
        table_name="location_space_task_templates",
    )
    op.drop_table("location_space_task_templates")

    op.drop_column("location_zones", "attributes")
    op.drop_index("ix_location_zones_parent_id", table_name="location_zones")
    op.drop_constraint(
        "fk_location_zones_parent_id",
        "location_zones",
        type_="foreignkey",
    )
    op.drop_column("location_zones", "parent_id")

    op.drop_index("ix_location_profiles_company_id", table_name="location_profiles")
    op.drop_table("location_profiles")
