from alembic import op
import sqlalchemy as sa
revision="h5i6j7k8l9m"
down_revision="g4h5i6j7k8l"
branch_labels=None
depends_on=None


def upgrade():
    for table in ("invoices","expenses","customer_payments","sales_ledger_records"):
        op.add_column(table,sa.Column("currency_snapshot",sa.JSON(),nullable=True))
    with op.batch_alter_table("customer_payment_allocations") as batch:
        batch.add_column(sa.Column("exchange_difference_eur",sa.Numeric(14,2),nullable=False,server_default="0"))
        batch.add_column(sa.Column("native_amount",sa.Numeric(18,6),nullable=True))
        batch.add_column(sa.Column("native_currency",sa.String(3),nullable=True))


def downgrade():
    with op.batch_alter_table("customer_payment_allocations") as batch:
        batch.drop_column("native_currency");batch.drop_column("native_amount");batch.drop_column("exchange_difference_eur")
    for table in ("sales_ledger_records","customer_payments","expenses","invoices"):op.drop_column(table,"currency_snapshot")
