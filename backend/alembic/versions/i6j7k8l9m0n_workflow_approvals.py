from alembic import op
import sqlalchemy as sa
revision="i6j7k8l9m0n"
down_revision="h5i6j7k8l9m"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("operations_approval_policies",sa.Column("company_id",sa.Integer(),sa.ForeignKey("companies.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("purchases_required",sa.Boolean(),nullable=False,server_default=sa.false()),sa.Column("task_close_required",sa.Boolean(),nullable=False,server_default=sa.false()),
        sa.Column("updated_by",sa.Integer(),sa.ForeignKey("users.id")),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now()))
    op.create_table("purchase_approvals",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("company_id",sa.Integer(),sa.ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True),
        sa.Column("requested_by",sa.Integer(),sa.ForeignKey("users.id"),nullable=False),sa.Column("payload",sa.JSON(),nullable=False),sa.Column("fingerprint",sa.String(64),nullable=False),
        sa.Column("status",sa.String(20),nullable=False,server_default="pending"),sa.Column("purchase_id",sa.Integer(),sa.ForeignKey("inventory_purchases.id"),unique=True),
        sa.Column("reviewed_by",sa.Integer(),sa.ForeignKey("users.id")),sa.Column("reviewed_at",sa.DateTime(timezone=True)),sa.Column("note",sa.Text(),nullable=False,server_default=""),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))
    op.create_table("task_close_approvals",sa.Column("task_id",sa.Integer(),sa.ForeignKey("task_items.id",ondelete="CASCADE"),primary_key=True),sa.Column("company_id",sa.Integer(),sa.ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True),
        sa.Column("fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(20),nullable=False,server_default="pending"),sa.Column("requested_by",sa.Integer(),sa.ForeignKey("users.id")),
        sa.Column("requested_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),sa.Column("reviewed_by",sa.Integer(),sa.ForeignKey("users.id")),sa.Column("reviewed_at",sa.DateTime(timezone=True)),sa.Column("note",sa.Text(),nullable=False,server_default=""))
    op.create_table("purchase_budget_links",sa.Column("approval_id",sa.Integer(),sa.ForeignKey("purchase_approvals.id",ondelete="CASCADE"),primary_key=True),sa.Column("request_id",sa.Integer(),sa.ForeignKey("internal_requests.id"),nullable=False,index=True),sa.Column("active_request_id",sa.Integer(),sa.ForeignKey("internal_requests.id"),nullable=True,unique=True),sa.CheckConstraint("active_request_id IS NULL OR active_request_id = request_id",name="ck_purchase_budget_active_request"))


def downgrade():
    op.drop_table("purchase_budget_links")
    op.drop_table("task_close_approvals");op.drop_table("purchase_approvals");op.drop_table("operations_approval_policies")
