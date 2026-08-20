"""add optional client assignment to expenses

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
"""

from alembic import op
import sqlalchemy as sa


revision = "j7k8l9m0n1o2"
down_revision = "i6j7k8l9m0n1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("client_id", sa.Integer(), nullable=True))
    op.create_index("ix_expenses_client_id", "expenses", ["client_id"], unique=False)
    op.create_foreign_key(
        "fk_expenses_client_id_clients",
        "expenses",
        "clients",
        ["client_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_expenses_client_id_clients", "expenses", type_="foreignkey")
    op.drop_index("ix_expenses_client_id", table_name="expenses")
    op.drop_column("expenses", "client_id")
