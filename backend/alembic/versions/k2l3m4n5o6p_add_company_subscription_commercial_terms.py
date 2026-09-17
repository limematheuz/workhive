"""add immutable commercial terms to company subscriptions

Revision ID: k2l3m4n5o6p
Revises: j1k2l3m4n5o6
"""

import sqlalchemy as sa
from alembic import op


revision = "k2l3m4n5o6p"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing subscriptions predate reliable commercial terms.  Keep every
    # new column nullable so those records remain explicitly unknown rather
    # than being priced from today's catalogue.
    with op.batch_alter_table("company_subscriptions") as batch:
        batch.add_column(
            sa.Column("commercial_billing_interval", sa.String(length=20), nullable=True)
        )
        batch.add_column(
            sa.Column("commercial_amount_cents", sa.Integer(), nullable=True)
        )
        batch.add_column(
            sa.Column("commercial_currency", sa.String(length=3), nullable=True)
        )
        batch.add_column(
            sa.Column("commercial_tax_behavior", sa.String(length=20), nullable=True)
        )
        batch.add_column(
            sa.Column(
                "commercial_terms_effective_at", sa.DateTime(timezone=True), nullable=True
            )
        )
        batch.create_check_constraint(
            "ck_company_subscription_commercial_terms_complete",
            "(commercial_billing_interval IS NULL AND commercial_amount_cents IS NULL AND commercial_currency IS NULL AND commercial_tax_behavior IS NULL AND commercial_terms_effective_at IS NULL) OR (commercial_billing_interval IS NOT NULL AND commercial_amount_cents IS NOT NULL AND commercial_currency IS NOT NULL AND commercial_tax_behavior IS NOT NULL AND commercial_terms_effective_at IS NOT NULL)",
        )
        batch.create_check_constraint(
            "ck_company_subscription_commercial_interval",
            "commercial_billing_interval IS NULL OR commercial_billing_interval IN ('monthly', 'annual')",
        )
        batch.create_check_constraint(
            "ck_company_subscription_commercial_amount",
            "commercial_amount_cents IS NULL OR commercial_amount_cents >= 0",
        )
        batch.create_check_constraint(
            "ck_company_subscription_commercial_tax",
            "commercial_tax_behavior IS NULL OR commercial_tax_behavior IN ('exclusive', 'inclusive')",
        )


def downgrade() -> None:
    with op.batch_alter_table("company_subscriptions") as batch:
        batch.drop_constraint(
            "ck_company_subscription_commercial_tax", type_="check"
        )
        batch.drop_constraint(
            "ck_company_subscription_commercial_amount", type_="check"
        )
        batch.drop_constraint(
            "ck_company_subscription_commercial_interval", type_="check"
        )
        batch.drop_constraint(
            "ck_company_subscription_commercial_terms_complete", type_="check"
        )
        batch.drop_column("commercial_terms_effective_at")
        batch.drop_column("commercial_tax_behavior")
        batch.drop_column("commercial_currency")
        batch.drop_column("commercial_amount_cents")
        batch.drop_column("commercial_billing_interval")
