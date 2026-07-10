"""add fiscal invoice integrity

Revision ID: s7j8k9l0m1n2
Revises: r6i7j8k9l0m1
"""

from alembic import op
import sqlalchemy as sa


revision = "s7j8k9l0m1n2"
down_revision = "r6i7j8k9l0m1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION DEFAULT 0")
    op.execute(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS equivalence_surcharge DOUBLE PRECISION DEFAULT 0"
    )
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention DOUBLE PRECISION DEFAULT 0")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms TEXT")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_address TEXT")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_issuer_info TEXT")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_recipient_info TEXT")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signature_url TEXT")

    op.execute("UPDATE invoices SET base_amount = 0 WHERE base_amount IS NULL")
    op.execute("UPDATE invoices SET tax_amount = 0 WHERE tax_amount IS NULL")
    op.execute("UPDATE invoices SET total_amount = 0 WHERE total_amount IS NULL")
    op.execute("UPDATE invoices SET discount = 0 WHERE discount IS NULL")
    op.execute(
        "UPDATE invoices SET equivalence_surcharge = 0 WHERE equivalence_surcharge IS NULL"
    )
    op.execute("UPDATE invoices SET retention = 0 WHERE retention IS NULL")

    op.alter_column(
        "invoices",
        "base_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 2),
        postgresql_using="round(base_amount::numeric, 2)",
        nullable=False,
        server_default="0",
    )
    op.alter_column(
        "invoices",
        "tax_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 2),
        postgresql_using="round(tax_amount::numeric, 2)",
        nullable=False,
        server_default="0",
    )
    op.alter_column(
        "invoices",
        "total_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 2),
        postgresql_using="round(total_amount::numeric, 2)",
        nullable=False,
        server_default="0",
    )
    for column_name in ("discount", "equivalence_surcharge", "retention"):
        op.alter_column(
            "invoices",
            column_name,
            existing_type=sa.Float(),
            type_=sa.Numeric(7, 4),
            postgresql_using=f"round({column_name}::numeric, 4)",
            nullable=False,
            server_default="0",
        )

    op.alter_column(
        "invoices", "notes", existing_type=sa.Text(), type_=sa.Text()
    )
    op.alter_column(
        "invoices", "terms", existing_type=sa.Text(), type_=sa.Text()
    )
    op.alter_column(
        "invoices", "shipping_address", existing_type=sa.Text(), type_=sa.Text()
    )
    op.alter_column(
        "invoices", "custom_issuer_info", existing_type=sa.Text(), type_=sa.Text()
    )
    op.alter_column(
        "invoices", "custom_recipient_info", existing_type=sa.Text(), type_=sa.Text()
    )

    op.add_column(
        "invoices", sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("invoices", sa.Column("issuer_snapshot", sa.JSON(), nullable=True))
    op.add_column("invoices", sa.Column("recipient_snapshot", sa.JSON(), nullable=True))
    op.add_column("invoices", sa.Column("rectification_reason", sa.Text(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column(
            "fiscal_submission_status",
            sa.String(length=30),
            server_default="not_configured",
            nullable=False,
        ),
    )
    op.add_column("invoices", sa.Column("qr_url", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("aeat_csv", sa.String(length=255), nullable=True))

    op.alter_column(
        "invoice_items",
        "quantity",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 4),
        postgresql_using="round(quantity::numeric, 4)",
        nullable=False,
    )
    op.alter_column(
        "invoice_items",
        "unit_price",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 4),
        postgresql_using="round(unit_price::numeric, 4)",
        nullable=False,
    )
    op.alter_column(
        "invoice_items",
        "tax_rate",
        existing_type=sa.Float(),
        type_=sa.Numeric(7, 6),
        postgresql_using="round(tax_rate::numeric, 6)",
        nullable=False,
    )
    op.alter_column(
        "invoice_items",
        "subtotal",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 2),
        postgresql_using="round(subtotal::numeric, 2)",
        nullable=False,
    )
    op.alter_column(
        "invoice_items",
        "total",
        existing_type=sa.Float(),
        type_=sa.Numeric(14, 2),
        postgresql_using="round(total::numeric, 2)",
        nullable=False,
    )
    op.create_index(
        "uq_invoice_items_task_item_active",
        "invoice_items",
        ["task_item_id"],
        unique=True,
        postgresql_where=sa.text("task_item_id IS NOT NULL"),
    )
    op.drop_constraint(
        "invoice_items_invoice_id_fkey",
        "invoice_items",
        type_="foreignkey",
    )
    op.drop_constraint(
        "invoice_items_task_item_id_fkey",
        "invoice_items",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_invoice_items_invoice_id",
        "invoice_items",
        "invoices",
        ["invoice_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_invoice_items_task_item_id",
        "invoice_items",
        "task_items",
        ["task_item_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "fiscal_invoice_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("record_type", sa.String(length=20), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("record_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "hash_algorithm",
            sa.String(length=20),
            server_default="SHA-256",
            nullable=False,
        ),
        sa.Column(
            "submission_status",
            sa.String(length=30),
            server_default="not_configured",
            nullable=False,
        ),
        sa.Column("aeat_csv", sa.String(length=255), nullable=True),
        sa.Column("aeat_response", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["invoices.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_hash"),
    )
    op.create_index(
        "ix_fiscal_invoice_records_company_id",
        "fiscal_invoice_records",
        ["company_id"],
    )
    op.create_index(
        "ix_fiscal_invoice_records_invoice_id",
        "fiscal_invoice_records",
        ["invoice_id"],
    )
    op.create_index(
        "ix_fiscal_invoice_records_record_hash",
        "fiscal_invoice_records",
        ["record_hash"],
        unique=True,
    )
    op.create_index(
        "ix_fiscal_invoice_records_submission_status",
        "fiscal_invoice_records",
        ["submission_status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_fiscal_invoice_records_submission_status",
        table_name="fiscal_invoice_records",
    )
    op.drop_index(
        "ix_fiscal_invoice_records_record_hash",
        table_name="fiscal_invoice_records",
    )
    op.drop_index(
        "ix_fiscal_invoice_records_invoice_id",
        table_name="fiscal_invoice_records",
    )
    op.drop_index(
        "ix_fiscal_invoice_records_company_id",
        table_name="fiscal_invoice_records",
    )
    op.drop_table("fiscal_invoice_records")
    op.drop_index(
        "uq_invoice_items_task_item_active", table_name="invoice_items"
    )
    op.drop_constraint(
        "fk_invoice_items_task_item_id",
        "invoice_items",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_invoice_items_invoice_id",
        "invoice_items",
        type_="foreignkey",
    )
    for column_name in (
        "aeat_csv",
        "qr_url",
        "fiscal_submission_status",
        "rectification_reason",
        "recipient_snapshot",
        "issuer_snapshot",
        "issued_at",
    ):
        op.drop_column("invoices", column_name)
