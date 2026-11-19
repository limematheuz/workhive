from alembic import op
import sqlalchemy as sa

revision = "p7q8r9s0t1u"
down_revision = "o6p7q8r9s0t"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("service_hours_reviews",
        sa.Column("task_id", sa.Integer, sa.ForeignKey("task_items.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("contract_minutes", sa.Integer), sa.Column("approved_seconds", sa.Integer),
        sa.Column("session_signature", sa.String(64)), sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_table("service_hours_reviews")
