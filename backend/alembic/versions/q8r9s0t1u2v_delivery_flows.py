
from alembic import op
import sqlalchemy as sa

revision = "q8r9s0t1u2v"
down_revision = "p7q8r9s0t1u"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("additional_work",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=False, index=True),
        sa.Column("title", sa.String(160), nullable=False), sa.Column("description", sa.Text),
        sa.Column("quote_id", sa.Integer, sa.ForeignKey("quotes.id"), unique=True),
        sa.Column("task_id", sa.Integer, sa.ForeignKey("task_items.id"), unique=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_table("advisory_access",
        sa.Column("grant_id", sa.Integer, sa.ForeignKey("external_access_grants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("accounting", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("payroll", sa.Boolean, nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_table("advisory_access")
    op.drop_table("additional_work")
