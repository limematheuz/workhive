"""track when invoices are paid

Revision ID: a7b8c9d0e1f2
Revises: z4q5r6s7t8u9
"""

from alembic import op
import sqlalchemy as sa


revision = "a7b8c9d0e1f2"
down_revision = "z4q5r6s7t8u9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE invoices SET paid_at = updated_at "
        "WHERE status = 'paid' AND paid_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column("invoices", "paid_at")
