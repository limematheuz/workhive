
from alembic import op
import sqlalchemy as sa

revision = "r9s0t1u2v3w"
down_revision = "q8r9s0t1u2v"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("company_preferences",
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("country",sa.String(2),nullable=False,server_default="ES"),
        sa.Column("currency",sa.String(3),nullable=False,server_default="EUR"),
        sa.Column("timezone",sa.String(80),nullable=False,server_default="Europe/Madrid"),
        sa.Column("language",sa.String(8),nullable=False,server_default="es"))
    op.create_table("staff_shifts",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False,index=True),
        sa.Column("location_id",sa.Integer,sa.ForeignKey("locations.id"),nullable=False,index=True),
        sa.Column("task_id",sa.Integer,sa.ForeignKey("task_items.id")),
        sa.Column("starts_at",sa.DateTime(timezone=True),nullable=False,index=True),
        sa.Column("ends_at",sa.DateTime(timezone=True),nullable=False))


def downgrade():
    op.drop_table("staff_shifts")
    op.drop_table("company_preferences")
