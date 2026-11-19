
from alembic import op
import sqlalchemy as sa

revision = "v3w4x5y6z7a"
down_revision = "u2v3w4x5y6z"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("internal_requests",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False),
        sa.Column("created_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.Column("kind",sa.String(30),nullable=False),sa.Column("description",sa.Text,nullable=False),
        sa.Column("starts_on",sa.Date,nullable=False),sa.Column("ends_on",sa.Date,nullable=False),
        sa.Column("amount",sa.Numeric(12,2),nullable=False,server_default="0"),
        sa.Column("status",sa.String(20),nullable=False,server_default="pending"),
        sa.Column("reviewed_by",sa.Integer,sa.ForeignKey("users.id")),
        sa.Column("reviewed_at",sa.DateTime(timezone=True)),
        sa.Column("absence_id",sa.Integer,sa.ForeignKey("staff_absences.id"),unique=True),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))


def downgrade():
    op.drop_table("internal_requests")
