
from alembic import op
import sqlalchemy as sa

revision = "s0t1u2v3w4x"
down_revision = "r9s0t1u2v3w"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("offline_work",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("user_id",sa.Integer,sa.ForeignKey("users.id"),nullable=False,index=True),
        sa.Column("task_id",sa.Integer,sa.ForeignKey("task_items.id"),nullable=False,index=True),
        sa.Column("event_id",sa.String(64),nullable=False),
        sa.Column("starts_at",sa.DateTime(timezone=True),nullable=False),
        sa.Column("ends_at",sa.DateTime(timezone=True),nullable=False),
        sa.Column("paused_seconds",sa.Integer,nullable=False,server_default="0"),
        sa.Column("checklist_ids",sa.JSON,nullable=False),sa.Column("description",sa.Text,nullable=False),
        sa.Column("status",sa.String(20),nullable=False,server_default="pending"),
        sa.Column("reviewed_by",sa.Integer,sa.ForeignKey("users.id")),
        sa.Column("reviewed_at",sa.DateTime(timezone=True)),
        sa.Column("session_id",sa.Integer,sa.ForeignKey("work_sessions.id"),unique=True),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.UniqueConstraint("user_id","event_id",name="uq_offline_work_user_event"))


def downgrade():
    op.drop_table("offline_work")
