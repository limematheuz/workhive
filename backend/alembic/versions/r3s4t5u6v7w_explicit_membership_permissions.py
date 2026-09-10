"""Remember explicit access configuration, including an empty set of profiles.

Revision ID: r3s4t5u6v7w
Revises: r2s3t4u5v6w
"""

from alembic import op
import sqlalchemy as sa

revision = "r3s4t5u6v7w"
down_revision = "r2s3t4u5v6w"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_memberships", sa.Column(
        "permissions_configured", sa.Boolean(), nullable=False, server_default=sa.false()
    ))
    op.execute(sa.text("""
        UPDATE company_memberships SET permissions_configured = true
        WHERE EXISTS (
            SELECT 1 FROM membership_permission_profile_assignments AS assignment
            WHERE assignment.company_membership_id = company_memberships.id
              AND assignment.company_id = company_memberships.company_id
        )
    """))


def downgrade() -> None:
    op.drop_column("company_memberships", "permissions_configured")
