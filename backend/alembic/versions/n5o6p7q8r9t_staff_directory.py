"""Independent company workforce directory."""
from alembic import op
import sqlalchemy as sa

revision = "n5o6p7q8r9t"
down_revision = "n5o6p7q8r9s"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("staff_employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("history", sa.JSON(), nullable=True),
        sa.Column("profile", sa.JSON(), nullable=True),
        sa.Column("name", sa.String(140), nullable=False),
        sa.Column("position", sa.String(120), nullable=False),
        sa.Column("team", sa.String(120), nullable=False),
        sa.Column("monthly_hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("hourly_cost", sa.Numeric(10, 2), nullable=False))
    op.create_index("ix_staff_employees_company_id", "staff_employees", ["company_id"])


def downgrade():
    op.drop_table("staff_employees")
