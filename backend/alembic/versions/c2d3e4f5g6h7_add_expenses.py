"""add expenses

Revision ID: c2d3e4f5g6h7
Revises: b6s7t8u9v0w1
"""

from alembic import op
import sqlalchemy as sa


revision = "c2d3e4f5g6h7"
down_revision = "b6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("expense_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("vendor", sa.String(length=160), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("payment_method", sa.String(length=60), nullable=True),
        sa.Column("base_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("receipt_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expenses_company_id"), "expenses", ["company_id"], unique=False)
    op.create_index(op.f("ix_expenses_created_by_user_id"), "expenses", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_expenses_expense_date"), "expenses", ["expense_date"], unique=False)
    op.create_index(op.f("ix_expenses_vendor"), "expenses", ["vendor"], unique=False)
    op.create_index(op.f("ix_expenses_category"), "expenses", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_expenses_category"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_vendor"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_expense_date"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_created_by_user_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_company_id"), table_name="expenses")
    op.drop_table("expenses")
