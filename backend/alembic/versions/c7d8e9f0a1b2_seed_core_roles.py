"""seed core roles

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
"""

from alembic import op


revision = "c7d8e9f0a1b2"
down_revision = "b6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        VALUES
            ('superadmin', 'WorkHive platform superadmin', TRUE),
            ('admin', 'Company administrator', TRUE),
            ('manager', 'Location manager', TRUE),
            ('viewer', 'Worker with operational access', TRUE)
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description,
            is_active = TRUE
        """
    )


def downgrade() -> None:
    # Roles may already be referenced by users; never remove them automatically.
    pass
