from alembic import op
import sqlalchemy as sa
revision="a8b9c0d1e2f"
down_revision="z7a8b9c0d1e"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("material_plans",
        sa.Column("work_order_id",sa.Integer,sa.ForeignKey("work_orders.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("material_id",sa.Integer,sa.ForeignKey("inventory_materials.id"),primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("quantity",sa.Numeric(14,3),nullable=False),sa.CheckConstraint("quantity >= 0",name="ck_material_plan_quantity"))
    op.create_table("subcontracts",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("work_order_id",sa.Integer,sa.ForeignKey("work_orders.id"),nullable=False,index=True),
        sa.Column("supplier_id",sa.Integer,sa.ForeignKey("inventory_suppliers.id"),nullable=False),
        sa.Column("amount",sa.Numeric(12,2),nullable=False),sa.Column("description",sa.String(255),nullable=False),
        sa.Column("document_url",sa.String(2000)),sa.Column("document_expires_on",sa.Date),
        sa.Column("status",sa.String(20),nullable=False),
        sa.Column("expense_id",sa.Integer,sa.ForeignKey("expenses.id"),unique=True),
        sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),
        sa.CheckConstraint("status IN ('planned','progress','completed','cancelled')",name="ck_subcontract_status"))
    op.create_table("saved_reports",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("user_id",sa.Integer,sa.ForeignKey("users.id"),nullable=False,index=True),
        sa.Column("name",sa.String(120),nullable=False),sa.Column("configuration",sa.JSON,nullable=False))


def downgrade():
    op.drop_table("saved_reports")
    op.drop_table("subcontracts")
    op.drop_table("material_plans")
