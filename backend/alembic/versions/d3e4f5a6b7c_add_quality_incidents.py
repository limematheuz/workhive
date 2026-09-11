"""add scoped quality incidents and corrective actions

Revision ID: d3e4f5a6b7c
Revises: c2d3e4f5a6b
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "d3e4f5a6b7c"
down_revision = "c2d3e4f5a6b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_incidents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("inspection_id", sa.Integer(), nullable=True),
        sa.Column("inspection_item_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(length=20), server_default="medium", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_quality_incident_severity"),
        sa.CheckConstraint("status IN ('open', 'in_progress', 'resolved', 'closed')", name="ck_quality_incident_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["inspection_id"], ["quality_inspections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inspection_item_id"], ["quality_inspection_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("company_id", "location_id", "inspection_id", "inspection_item_id", "severity", "status"):
        op.create_index(f"ix_quality_incidents_{column}", "quality_incidents", [column])
    op.create_table(
        "quality_corrective_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("incident_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("completed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'completed', 'cancelled')", name="ck_quality_corrective_action_status"),
        sa.ForeignKeyConstraint(["incident_id"], ["quality_incidents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["completed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_corrective_actions_incident_id", "quality_corrective_actions", ["incident_id"])
    op.create_index("ix_quality_corrective_actions_status", "quality_corrective_actions", ["status"])
    permission_definitions = sa.table("permission_definitions", sa.column("code", sa.String), sa.column("category", sa.String), sa.column("description", sa.String), sa.column("is_active", sa.Boolean))
    op.bulk_insert(permission_definitions, [
        {"code": "quality.incidents.read", "category": "quality", "description": "View quality incidents and corrective actions", "is_active": True},
        {"code": "quality.incidents.manage", "category": "quality", "description": "Manage quality incidents and corrective actions", "is_active": True},
    ])
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('quality.incidents.read', 'quality.incidents.manage')
        WHERE profiles.name = 'Administrador de empresa'
          AND NOT EXISTS (
            SELECT 1 FROM permission_profile_permissions AS existing
            WHERE existing.permission_profile_id = profiles.id
              AND existing.permission_definition_id = definitions.id
          )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM permission_profile_permissions WHERE permission_definition_id IN (SELECT id FROM permission_definitions WHERE code IN ('quality.incidents.read', 'quality.incidents.manage'))")
    op.execute("DELETE FROM permission_definitions WHERE code IN ('quality.incidents.read', 'quality.incidents.manage')")
    op.drop_index("ix_quality_corrective_actions_status", table_name="quality_corrective_actions")
    op.drop_index("ix_quality_corrective_actions_incident_id", table_name="quality_corrective_actions")
    op.drop_table("quality_corrective_actions")
    for column in ("status", "severity", "inspection_item_id", "inspection_id", "location_id", "company_id"):
        op.drop_index(f"ix_quality_incidents_{column}", table_name="quality_incidents")
    op.drop_table("quality_incidents")
