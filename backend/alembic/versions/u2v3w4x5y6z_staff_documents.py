
from alembic import op
import sqlalchemy as sa

revision = "u2v3w4x5y6z"
down_revision = "t1u2v3w4x5y"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("staff_accounts",
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("user_id",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.UniqueConstraint("company_id","user_id",name="uq_staff_company_account"))
    op.create_table("staff_document_receipts",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False),
        sa.Column("user_id",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.Column("digest",sa.String(64),nullable=False),
        sa.Column("acknowledged_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.UniqueConstraint("employee_id","user_id","digest",name="uq_staff_document_receipt"))


def downgrade():
    op.drop_table("staff_document_receipts")
    op.drop_table("staff_accounts")
