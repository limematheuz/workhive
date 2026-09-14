"""add client quality complaints

Revision ID: g8h9i0j1k2l3
Revises: f6a7b8c9d0e
"""

import sqlalchemy as sa
from alembic import op


revision = "g8h9i0j1k2l3"
down_revision = "f6a7b8c9d0e"
branch_labels = None
depends_on = None


_CODES = ("quality.complaints.read", "quality.complaints.manage")


def upgrade() -> None:
    op.create_table(
        "quality_complaints",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("client_portal_grant_id", sa.Integer(), nullable=True),
        sa.Column("submitted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False, server_default="service"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="submitted"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="internal"),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("customer_response", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("category IN ('service', 'billing', 'damage', 'other')", name="ck_quality_complaint_category"),
        sa.CheckConstraint("status IN ('submitted', 'in_review', 'resolved', 'closed')", name="ck_quality_complaint_status"),
        sa.CheckConstraint("source IN ('client_portal', 'internal')", name="ck_quality_complaint_source"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["client_portal_grant_id"], ["client_portal_grants.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["submitted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("company_id", "client_id", "location_id", "client_portal_grant_id", "category", "status", "source"):
        op.create_index(f"ix_quality_complaints_{column}", "quality_complaints", [column])

    permission_definitions = sa.table(
        "permission_definitions",
        sa.column("code", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(permission_definitions, [
        {"code": "quality.complaints.read", "category": "quality", "description": "View customer complaints", "is_active": True},
        {"code": "quality.complaints.manage", "category": "quality", "description": "Manage customer complaints", "is_active": True},
    ])
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_profile_permissions AS existing
          ON existing.permission_profile_id = profiles.id
        JOIN permission_definitions AS existing_definition
          ON existing_definition.id = existing.permission_definition_id
         AND existing_definition.code IN ('quality.incidents.read', 'quality.incidents.manage')
        JOIN permission_definitions AS definitions
          ON (existing_definition.code = 'quality.incidents.read' AND definitions.code = 'quality.complaints.read')
          OR (existing_definition.code = 'quality.incidents.manage' AND definitions.code = 'quality.complaints.manage')
        WHERE NOT EXISTS (
            SELECT 1 FROM permission_profile_permissions AS assigned
            WHERE assigned.permission_profile_id = profiles.id
              AND assigned.permission_definition_id = definitions.id
        )
        """
    )


def downgrade() -> None:
    codes = ", ".join(f"'{code}'" for code in _CODES)
    op.execute(
        "DELETE FROM permission_profile_permissions WHERE permission_definition_id IN "
        f"(SELECT id FROM permission_definitions WHERE code IN ({codes}))"
    )
    op.execute(f"DELETE FROM permission_definitions WHERE code IN ({codes})")
    for column in ("source", "status", "category", "client_portal_grant_id", "location_id", "client_id", "company_id"):
        op.drop_index(f"ix_quality_complaints_{column}", table_name="quality_complaints")
    op.drop_table("quality_complaints")
