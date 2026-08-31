"""add versioned plan prices

Revision ID: o4p5q6r7s8t9
Revises: n3o4p5q6r7s8
"""

from alembic import op
import sqlalchemy as sa


revision = "o4p5q6r7s8t9"
down_revision = "n3o4p5q6r7s8"
branch_labels = None
depends_on = None


_PRICE_CENTS = {
    "basic": {"monthly": 2900, "annual": 28800},
    "medium": {"monthly": 6900, "annual": 70800},
    "top": {"monthly": 12900, "annual": 130800},
    "mega": {"monthly": 24900, "annual": 250800},
}


def upgrade() -> None:
    op.create_table(
        "plan_prices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("billing_interval", sa.String(length=20), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column(
            "tax_behavior", sa.String(length=20), nullable=False, server_default="exclusive"
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "billing_interval IN ('monthly', 'annual')",
            name="ck_plan_price_billing_interval",
        ),
        sa.CheckConstraint("amount_cents >= 0", name="ck_plan_price_amount_non_negative"),
        sa.CheckConstraint(
            "tax_behavior IN ('exclusive', 'inclusive')",
            name="ck_plan_price_tax_behavior",
        ),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("plan_id", "billing_interval", name="uq_plan_price_plan_interval"),
    )
    op.create_index("ix_plan_prices_plan_id", "plan_prices", ["plan_id"])
    with op.batch_alter_table("company_purchase_intents") as batch_op:
        batch_op.add_column(
            sa.Column(
                "billing_interval",
                sa.String(length=20),
                nullable=False,
                server_default="monthly",
            )
        )
        batch_op.create_check_constraint(
            "ck_company_purchase_intent_billing_interval",
            "billing_interval IN ('monthly', 'annual')",
        )

    bind = op.get_bind()
    plans = sa.table(
        "subscription_plans",
        sa.column("id", sa.Integer()),
        sa.column("code", sa.String()),
    )
    plan_prices = sa.table(
        "plan_prices",
        sa.column("plan_id", sa.Integer()),
        sa.column("billing_interval", sa.String()),
        sa.column("amount_cents", sa.Integer()),
        sa.column("currency", sa.String()),
        sa.column("tax_behavior", sa.String()),
    )
    rows = bind.execute(sa.select(plans.c.id, plans.c.code)).mappings().all()
    values = [
        {
            "plan_id": row["id"],
            "billing_interval": billing_interval,
            "amount_cents": amount_cents,
            "currency": "EUR",
            "tax_behavior": "exclusive",
        }
        for row in rows
        if row["code"] in _PRICE_CENTS
        for billing_interval, amount_cents in _PRICE_CENTS[row["code"]].items()
    ]
    if values:
        bind.execute(plan_prices.insert(), values)


def downgrade() -> None:
    with op.batch_alter_table("company_purchase_intents") as batch_op:
        batch_op.drop_constraint(
            "ck_company_purchase_intent_billing_interval", type_="check"
        )
        batch_op.drop_column("billing_interval")
    op.drop_index("ix_plan_prices_plan_id", table_name="plan_prices")
    op.drop_table("plan_prices")
