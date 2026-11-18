from alembic import op
import sqlalchemy as sa
revision="g4h5i6j7k8l"
down_revision="f3g4h5i6j7k"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("accounting_periods",sa.Column("id",sa.Integer(),primary_key=True),
        sa.Column("company_id",sa.Integer(),sa.ForeignKey("companies.id",ondelete="CASCADE"),nullable=False),
        sa.Column("month",sa.String(7),nullable=False),sa.Column("status",sa.String(10),nullable=False),
        sa.Column("revision",sa.Integer(),nullable=False),sa.Column("snapshot",sa.JSON()),
        sa.Column("closed_at",sa.DateTime(timezone=True)),sa.Column("closed_by",sa.Integer(),sa.ForeignKey("users.id",ondelete="SET NULL")),
        sa.Column("reopened_at",sa.DateTime(timezone=True)),sa.Column("reopened_by",sa.Integer(),sa.ForeignKey("users.id",ondelete="SET NULL")),
        sa.UniqueConstraint("company_id","month",name="uq_accounting_period_company_month"),sa.CheckConstraint("status IN ('open','closed')",name="ck_accounting_period_status"))
    op.create_index("ix_accounting_periods_company_id","accounting_periods",["company_id"])
    op.create_table("accounting_period_events",sa.Column("id",sa.Integer(),primary_key=True),
        sa.Column("period_id",sa.Integer(),sa.ForeignKey("accounting_periods.id",ondelete="CASCADE"),nullable=False),
        sa.Column("company_id",sa.Integer(),sa.ForeignKey("companies.id",ondelete="CASCADE"),nullable=False),
        sa.Column("action",sa.String(10),nullable=False),sa.Column("revision",sa.Integer(),nullable=False),
        sa.Column("reason",sa.Text(),nullable=False),sa.Column("actor_id",sa.Integer(),sa.ForeignKey("users.id",ondelete="SET NULL")),
        sa.Column("snapshot",sa.JSON()),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False))
    op.create_index("ix_accounting_period_events_period_id","accounting_period_events",["period_id"])
    op.create_index("ix_accounting_period_events_company_id","accounting_period_events",["company_id"])
    with op.batch_alter_table("advisory_access") as batch:
        batch.add_column(sa.Column("can_close_periods",sa.Boolean(),nullable=False,server_default=sa.false()))


def downgrade():
    with op.batch_alter_table("advisory_access") as batch:batch.drop_column("can_close_periods")
    op.drop_table("accounting_period_events")
    op.drop_table("accounting_periods")
