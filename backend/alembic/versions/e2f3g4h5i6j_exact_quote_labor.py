from alembic import op
import sqlalchemy as sa
revision="e2f3g4h5i6j"
down_revision="d1e2f3g4h5i"
branch_labels=None
depends_on=None


def upgrade():
    with op.batch_alter_table("quote_cost_estimates") as batch:
        batch.add_column(sa.Column("labor_amount",sa.Numeric(12,2),nullable=True))
        batch.create_check_constraint("ck_quote_estimate_exact_labor","labor_amount IS NULL OR labor_amount >= 0")


def downgrade():
    with op.batch_alter_table("quote_cost_estimates") as batch:
        batch.drop_constraint("ck_quote_estimate_exact_labor",type_="check")
        batch.drop_column("labor_amount")
