"""track three-day trial expiry notices

Revision ID: aa1b2c3d4e5f
Revises: z4q5r6s7t8u9, j2e3f4g5h6i7
"""

from alembic import op
import sqlalchemy as sa


revision = "aa1b2c3d4e5f"
down_revision = ("z4q5r6s7t8u9", "j2e3f4g5h6i7")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("trial_expiry_notice_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("companies", "trial_expiry_notice_sent_at")
