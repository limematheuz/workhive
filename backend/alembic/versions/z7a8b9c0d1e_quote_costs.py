
from alembic import op
import sqlalchemy as sa

revision="z7a8b9c0d1e"
down_revision="y6z7a8b9c0d"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("quote_cost_estimates",
        sa.Column("quote_id",sa.Integer,sa.ForeignKey("quotes.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("revision",sa.Integer,nullable=False),
        sa.Column("labor_hours",sa.Numeric(12,2),nullable=False),
        sa.Column("hourly_cost",sa.Numeric(12,2),nullable=False),
        sa.Column("materials",sa.Numeric(12,2),nullable=False),
        sa.Column("other_costs",sa.Numeric(12,2),nullable=False),
        sa.Column("updated_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False))


def downgrade():
    op.drop_table("quote_cost_estimates")
