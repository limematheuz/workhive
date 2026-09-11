"""add scoped quality inspections

Revision ID: c2d3e4f5a6b
Revises: b1c2d3e4f5a
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "c2d3e4f5a6b"
down_revision = "b1c2d3e4f5a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_inspections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("template_title", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("completed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'completed')", name="ck_quality_inspection_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["template_id"], ["quality_inspection_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["completed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_inspections_company_id", "quality_inspections", ["company_id"])
    op.create_index("ix_quality_inspections_location_id", "quality_inspections", ["location_id"])
    op.create_index("ix_quality_inspections_template_id", "quality_inspections", ["template_id"])
    op.create_index("ix_quality_inspections_status", "quality_inspections", ["status"])
    op.create_table(
        "quality_inspection_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inspection_id", sa.Integer(), nullable=False),
        sa.Column("template_item_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("max_points", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="not_assessed", nullable=False),
        sa.Column("points_awarded", sa.Integer(), server_default="0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("position >= 0", name="ck_quality_inspection_item_position"),
        sa.CheckConstraint("max_points > 0", name="ck_quality_inspection_item_points"),
        sa.CheckConstraint("status IN ('not_assessed', 'passed', 'failed')", name="ck_quality_inspection_item_status"),
        sa.CheckConstraint("points_awarded >= 0", name="ck_quality_inspection_item_awarded"),
        sa.CheckConstraint("points_awarded <= max_points", name="ck_quality_inspection_item_awarded_max"),
        sa.ForeignKeyConstraint(["inspection_id"], ["quality_inspections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_item_id"], ["quality_inspection_template_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_inspection_items_inspection_id", "quality_inspection_items", ["inspection_id"])
    permission_definitions = sa.table(
        "permission_definitions",
        sa.column("code", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(permission_definitions, [
        {"code": "quality.inspections.read", "category": "quality", "description": "View quality inspections", "is_active": True},
        {"code": "quality.inspections.manage", "category": "quality", "description": "Perform and close quality inspections", "is_active": True},
    ])
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('quality.inspections.read', 'quality.inspections.manage')
        WHERE profiles.name = 'Administrador de empresa'
          AND NOT EXISTS (
            SELECT 1 FROM permission_profile_permissions AS existing
            WHERE existing.permission_profile_id = profiles.id
              AND existing.permission_definition_id = definitions.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM permission_profile_permissions WHERE permission_definition_id IN "
        "(SELECT id FROM permission_definitions WHERE code IN ('quality.inspections.read', 'quality.inspections.manage'))"
    )
    op.execute(
        "DELETE FROM permission_definitions WHERE code IN ('quality.inspections.read', 'quality.inspections.manage')"
    )
    op.drop_index("ix_quality_inspection_items_inspection_id", table_name="quality_inspection_items")
    op.drop_table("quality_inspection_items")
    op.drop_index("ix_quality_inspections_status", table_name="quality_inspections")
    op.drop_index("ix_quality_inspections_template_id", table_name="quality_inspections")
    op.drop_index("ix_quality_inspections_location_id", table_name="quality_inspections")
    op.drop_index("ix_quality_inspections_company_id", table_name="quality_inspections")
    op.drop_table("quality_inspections")
