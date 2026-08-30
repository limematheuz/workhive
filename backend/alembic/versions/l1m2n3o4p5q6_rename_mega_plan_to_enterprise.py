"""rename the Mega plan display name to Enterprise

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
"""

from alembic import op
import sqlalchemy as sa


revision = "l1m2n3o4p5q6"
down_revision = "k0l1m2n3o4p5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE subscription_plans "
            "SET name = 'Enterprise' "
            "WHERE code = 'mega' AND name = 'Mega'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE subscription_plans "
            "SET name = 'Mega' "
            "WHERE code = 'mega' AND name = 'Enterprise'"
        )
    )
