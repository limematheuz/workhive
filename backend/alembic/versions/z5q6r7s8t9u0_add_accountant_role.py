"""add accountant role

Revision ID: z5q6r7s8t9u0
Revises: j7k8l9m0n1o2
"""

from alembic import op


revision = "z5q6r7s8t9u0"
down_revision = "j7k8l9m0n1o2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        VALUES ('accountant', 'External accountant with read-only financial access', TRUE)
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description,
            is_active = TRUE
        """
    )


def downgrade() -> None:
    # Existing users may reference this role; never remove it automatically.
    pass
