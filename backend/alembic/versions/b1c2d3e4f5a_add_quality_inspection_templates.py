"""add scoped quality inspection templates

Revision ID: b1c2d3e4f5a
Revises: a0b1c2d3e4f
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "b1c2d3e4f5a"
down_revision = "a0b1c2d3e4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_inspection_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_inspection_templates_company_id", "quality_inspection_templates", ["company_id"])
    op.create_index("ix_quality_inspection_templates_location_id", "quality_inspection_templates", ["location_id"])
    op.create_index("ix_quality_inspection_templates_is_active", "quality_inspection_templates", ["is_active"])
    op.create_table(
        "quality_inspection_template_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("max_points", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_quality_template_item_position"),
        sa.CheckConstraint("max_points > 0", name="ck_quality_template_item_points"),
        sa.ForeignKeyConstraint(["template_id"], ["quality_inspection_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_inspection_template_items_template_id", "quality_inspection_template_items", ["template_id"])
    permission_definitions = sa.table(
        "permission_definitions",
        sa.column("code", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(permission_definitions, [
        {"code": "quality.templates.read", "category": "quality", "description": "View inspection templates", "is_active": True},
        {"code": "quality.templates.manage", "category": "quality", "description": "Create and update inspection templates", "is_active": True},
    ])
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('quality.templates.read', 'quality.templates.manage')
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
        "(SELECT id FROM permission_definitions WHERE code IN ('quality.templates.read', 'quality.templates.manage'))"
    )
    op.execute(
        "DELETE FROM permission_definitions WHERE code IN ('quality.templates.read', 'quality.templates.manage')"
    )
    op.drop_index("ix_quality_inspection_template_items_template_id", table_name="quality_inspection_template_items")
    op.drop_table("quality_inspection_template_items")
    op.drop_index("ix_quality_inspection_templates_is_active", table_name="quality_inspection_templates")
    op.drop_index("ix_quality_inspection_templates_location_id", table_name="quality_inspection_templates")
    op.drop_index("ix_quality_inspection_templates_company_id", table_name="quality_inspection_templates")
    op.drop_table("quality_inspection_templates")
