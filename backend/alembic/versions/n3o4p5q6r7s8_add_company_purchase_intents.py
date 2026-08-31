"""add paid company purchase intents

Revision ID: n3o4p5q6r7s8
Revises: m2n3o4p5q6r7
"""

from alembic import op
import sqlalchemy as sa


revision = "n3o4p5q6r7s8"
down_revision = "m2n3o4p5q6r7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_purchase_intents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("plan_code", sa.String(length=50), nullable=False),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=100), nullable=False),
        sa.Column("tax_id", sa.String(length=20), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("postal_code", sa.String(length=10), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("province", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("company_email", sa.String(length=100), nullable=False),
        sa.Column("owner_full_name", sa.String(length=100), nullable=False),
        sa.Column("owner_email", sa.String(length=255), nullable=False),
        sa.Column("marketing_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("privacy_policy_version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="checkout_created"),
        sa.Column("stripe_checkout_session_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(length=100), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=100), nullable=True),
        sa.Column("activation_token_hash", sa.String(length=64), nullable=True),
        sa.Column("activation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_company_id", sa.Integer(), nullable=True),
        sa.Column("activated_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('checkout_created', 'checkout_completed', 'paid', 'activated', 'expired', 'canceled')",
            name="ck_company_purchase_intent_status",
        ),
        sa.ForeignKeyConstraint(["activated_company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["activated_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("activation_token_hash", name="uq_company_purchase_intent_activation_token"),
        sa.UniqueConstraint("stripe_checkout_session_id", name="uq_company_purchase_intent_checkout_session"),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_company_purchase_intent_subscription"),
    )
    op.create_index("ix_company_purchase_intents_plan_id", "company_purchase_intents", ["plan_id"])
    op.create_index("ix_company_purchase_intents_plan_code", "company_purchase_intents", ["plan_code"])
    op.create_index("ix_company_purchase_intents_tax_id", "company_purchase_intents", ["tax_id"])
    op.create_index("ix_company_purchase_intents_owner_email", "company_purchase_intents", ["owner_email"])
    op.create_index("ix_company_purchase_intents_status", "company_purchase_intents", ["status"])
    op.create_index("ix_company_purchase_intents_stripe_customer_id", "company_purchase_intents", ["stripe_customer_id"])
    op.create_index("ix_company_purchase_intents_activated_company_id", "company_purchase_intents", ["activated_company_id"])
    op.create_index("ix_company_purchase_intents_activated_user_id", "company_purchase_intents", ["activated_user_id"])


def downgrade() -> None:
    op.drop_index("ix_company_purchase_intents_activated_user_id", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_activated_company_id", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_stripe_customer_id", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_status", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_owner_email", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_tax_id", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_plan_code", table_name="company_purchase_intents")
    op.drop_index("ix_company_purchase_intents_plan_id", table_name="company_purchase_intents")
    op.drop_table("company_purchase_intents")
