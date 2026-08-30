"""add versioned plan entitlements

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
"""

from alembic import op
import sqlalchemy as sa


revision = "k0l1m2n3o4p5"
down_revision = "j9k0l1m2n3o4"
branch_labels = None
depends_on = None


FEATURE_CODES = (
    "features.organization",
    "features.teams",
    "features.clients",
    "features.locations",
    "features.work_orders",
    "features.time_tracking",
    "features.quotes",
    "features.invoices",
    "features.service_catalog",
    "features.recurrence",
    "features.planning",
    "features.basic_exports",
    "features.client_portal",
    "features.quality",
    "features.profitability",
    "features.inventory",
    "features.hr",
    "features.partner_portal",
    "features.accountant_portal",
    "features.integrations",
    "features.approvals",
    "features.branches",
    "features.corporate_structure",
    "features.api",
    "features.advanced_integrations",
)
CORE_FEATURES = set(FEATURE_CODES[:8])
MEDIUM_FEATURES = CORE_FEATURES | {
    "features.service_catalog",
    "features.recurrence",
    "features.planning",
    "features.basic_exports",
    "features.client_portal",
}
TOP_FEATURES = MEDIUM_FEATURES | {
    "features.quality",
    "features.profitability",
    "features.inventory",
    "features.hr",
    "features.partner_portal",
    "features.accountant_portal",
    "features.integrations",
    "features.approvals",
}
PLAN_FEATURES = {
    "basic": CORE_FEATURES,
    "medium": MEDIUM_FEATURES,
    "top": TOP_FEATURES,
    "mega": set(FEATURE_CODES),
    "custom": set(FEATURE_CODES),
}
PLAN_LIMITS = {
    "basic": (1, 2, 5, 1, 2, 5, 1),
    "medium": (3, 8, 25, 5, 10, 25, 2),
    "top": (10, 20, 100, 25, 50, 100, 5),
    "mega": (25, 75, 500, 100, 250, 500, 20),
}
QUOTA_CODES = (
    "limits.internal_admins",
    "limits.internal_responsibles",
    "limits.internal_workers",
    "limits.departments",
    "limits.teams",
    "limits.external_portals",
    "limits.accountant_portals",
)
PLAN_NAMES = {
    "basic": "Basic",
    "medium": "Medium",
    "top": "Top",
    "mega": "Enterprise",
    "custom": "Custom",
}
LEGACY_PLAN_CODES = {
    "free": "basic",
    "trial": "top",
    "business": "medium",
    "pro": "top",
    "lifetime": "top",
    "none": "basic",
}


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("billing_provider", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "code", "version", name="uq_subscription_plan_code_version"
        ),
    )
    op.create_index("ix_subscription_plans_code", "subscription_plans", ["code"])
    op.create_index(
        "ix_subscription_plans_is_active", "subscription_plans", ["is_active"]
    )
    op.create_table(
        "plan_entitlements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey("subscription_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=120), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("integer_value", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "value_type IN ('boolean', 'integer')",
            name="ck_plan_entitlement_value_type",
        ),
        sa.CheckConstraint(
            "(value_type = 'boolean' AND boolean_value IS NOT NULL AND integer_value IS NULL) OR (value_type = 'integer' AND boolean_value IS NULL AND integer_value IS NOT NULL)",
            name="ck_plan_entitlement_value",
        ),
        sa.CheckConstraint(
            "integer_value IS NULL OR integer_value >= 0",
            name="ck_plan_entitlement_non_negative_integer",
        ),
        sa.UniqueConstraint("plan_id", "code", name="uq_plan_entitlement_plan_code"),
    )
    op.create_index("ix_plan_entitlements_plan_id", "plan_entitlements", ["plan_id"])
    op.create_index("ix_plan_entitlements_code", "plan_entitlements", ["code"])
    op.create_table(
        "company_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("billing_provider", sa.String(length=50), nullable=True),
        sa.Column("billing_customer_id", sa.String(length=100), nullable=True),
        sa.Column("billing_subscription_id", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('trialing', 'active', 'pending', 'past_due', 'unpaid', 'paused', 'canceled', 'expired', 'inactive', 'incomplete', 'incomplete_expired')",
            name="ck_company_subscription_status",
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_company_subscription_dates",
        ),
    )
    for column in (
        "company_id",
        "plan_id",
        "status",
        "billing_customer_id",
        "billing_subscription_id",
    ):
        op.create_index(
            f"ix_company_subscriptions_{column}", "company_subscriptions", [column]
        )
    op.create_table(
        "company_entitlement_overrides",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=120), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("integer_value", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "starts_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "configured_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "value_type IN ('boolean', 'integer')",
            name="ck_company_entitlement_override_value_type",
        ),
        sa.CheckConstraint(
            "(value_type = 'boolean' AND boolean_value IS NOT NULL AND integer_value IS NULL) OR (value_type = 'integer' AND boolean_value IS NULL AND integer_value IS NOT NULL)",
            name="ck_company_entitlement_override_value",
        ),
        sa.CheckConstraint(
            "integer_value IS NULL OR integer_value >= 0",
            name="ck_company_entitlement_override_non_negative_integer",
        ),
        sa.CheckConstraint(
            "ends_at IS NULL OR ends_at >= starts_at",
            name="ck_company_entitlement_override_dates",
        ),
    )
    for column in ("company_id", "code", "ends_at", "configured_by_user_id"):
        op.create_index(
            f"ix_company_entitlement_overrides_{column}",
            "company_entitlement_overrides",
            [column],
        )
    op.create_table(
        "entitlement_change_audits",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_subscription_id",
            sa.Integer(),
            sa.ForeignKey("company_subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "company_entitlement_override_id",
            sa.Integer(),
            sa.ForeignKey("company_entitlement_overrides.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "actor_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("previous_value", sa.JSON(), nullable=True),
        sa.Column("next_value", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in (
        "company_id",
        "company_subscription_id",
        "company_entitlement_override_id",
        "actor_user_id",
        "request_id",
        "action",
    ):
        op.create_index(
            f"ix_entitlement_change_audits_{column}",
            "entitlement_change_audits",
            [column],
        )
    _seed_catalog_and_backfill()


def _seed_catalog_and_backfill() -> None:
    bind = op.get_bind()
    plans = sa.table(
        "subscription_plans",
        sa.column("id", sa.Integer()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("version", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    entitlements = sa.table(
        "plan_entitlements",
        sa.column("plan_id", sa.Integer()),
        sa.column("code", sa.String()),
        sa.column("value_type", sa.String()),
        sa.column("boolean_value", sa.Boolean()),
        sa.column("integer_value", sa.Integer()),
    )
    subscriptions = sa.table(
        "company_subscriptions",
        sa.column("company_id", sa.Integer()),
        sa.column("plan_id", sa.Integer()),
        sa.column("status", sa.String()),
        sa.column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.column("billing_provider", sa.String()),
        sa.column("billing_customer_id", sa.String()),
        sa.column("billing_subscription_id", sa.String()),
    )
    bind.execute(
        plans.insert(),
        [
            {"code": code, "name": PLAN_NAMES[code], "version": 1, "is_active": True}
            for code in PLAN_NAMES
        ],
    )
    plan_ids = dict(bind.execute(sa.select(plans.c.code, plans.c.id)).all())
    values = []
    for plan_code, features in PLAN_FEATURES.items():
        for code in FEATURE_CODES:
            values.append(
                {
                    "plan_id": plan_ids[plan_code],
                    "code": code,
                    "value_type": "boolean",
                    "boolean_value": code in features,
                    "integer_value": None,
                }
            )
        for code, value in zip(
            QUOTA_CODES, PLAN_LIMITS.get(plan_code, PLAN_LIMITS["mega"]), strict=True
        ):
            values.append(
                {
                    "plan_id": plan_ids[plan_code],
                    "code": code,
                    "value_type": "integer",
                    "boolean_value": None,
                    "integer_value": value,
                }
            )
    bind.execute(entitlements.insert(), values)
    companies = sa.table(
        "companies",
        sa.column("id", sa.Integer()),
        sa.column("subscription_plan", sa.String()),
        sa.column("subscription_status", sa.String()),
        sa.column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.column("stripe_customer_id", sa.String()),
        sa.column("stripe_subscription_id", sa.String()),
    )
    rows = bind.execute(sa.select(companies)).mappings().all()
    if rows:
        bind.execute(
            subscriptions.insert(),
            [
                {
                    "company_id": row["id"],
                    "plan_id": plan_ids[
                        LEGACY_PLAN_CODES.get(row["subscription_plan"], "basic")
                    ],
                    "status": row["subscription_status"],
                    "trial_ends_at": row["trial_ends_at"],
                    "billing_provider": "stripe"
                    if row["stripe_customer_id"] or row["stripe_subscription_id"]
                    else None,
                    "billing_customer_id": row["stripe_customer_id"],
                    "billing_subscription_id": row["stripe_subscription_id"],
                }
                for row in rows
            ],
        )


def downgrade() -> None:
    for column in (
        "action",
        "request_id",
        "actor_user_id",
        "company_entitlement_override_id",
        "company_subscription_id",
        "company_id",
    ):
        op.drop_index(
            f"ix_entitlement_change_audits_{column}",
            table_name="entitlement_change_audits",
        )
    op.drop_table("entitlement_change_audits")
    for column in ("configured_by_user_id", "ends_at", "code", "company_id"):
        op.drop_index(
            f"ix_company_entitlement_overrides_{column}",
            table_name="company_entitlement_overrides",
        )
    op.drop_table("company_entitlement_overrides")
    for column in (
        "billing_subscription_id",
        "billing_customer_id",
        "status",
        "plan_id",
        "company_id",
    ):
        op.drop_index(
            f"ix_company_subscriptions_{column}", table_name="company_subscriptions"
        )
    op.drop_table("company_subscriptions")
    op.drop_index("ix_plan_entitlements_code", table_name="plan_entitlements")
    op.drop_index("ix_plan_entitlements_plan_id", table_name="plan_entitlements")
    op.drop_table("plan_entitlements")
    op.drop_index("ix_subscription_plans_is_active", table_name="subscription_plans")
    op.drop_index("ix_subscription_plans_code", table_name="subscription_plans")
    op.drop_table("subscription_plans")
