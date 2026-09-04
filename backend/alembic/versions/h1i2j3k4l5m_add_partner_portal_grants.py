"""add sponsored partner portal grants

Revision ID: h1i2j3k4l5m
Revises: g0h1i2j3k4l5
"""

from alembic import op
import sqlalchemy as sa


revision = "h1i2j3k4l5m"
down_revision = "g0h1i2j3k4l5"
branch_labels = None
depends_on = None


PARTNER_PORTAL_QUOTAS = {
    "basic": 0,
    "medium": 0,
    "top": 2,
    "mega": 10,
    "custom": 10,
}


def upgrade() -> None:
    op.create_table(
        "partner_portal_grants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("host_company_id", sa.Integer(), nullable=False),
        sa.Column("partner_company_id", sa.Integer(), nullable=False),
        sa.Column("collaboration_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("granted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("revoked_by_user_id", sa.Integer(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'revoked')", name="ck_partner_portal_grant_status"),
        sa.CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="ck_partner_portal_grant_revocation_date"),
        sa.ForeignKeyConstraint(["host_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collaboration_id"], ["company_collaborations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("collaboration_id", "user_id", name="uq_partner_portal_grant_collaboration_user"),
    )
    for column in (
        "host_company_id",
        "partner_company_id",
        "collaboration_id",
        "user_id",
        "status",
        "expires_at",
        "granted_by_user_id",
        "revoked_by_user_id",
    ):
        op.create_index(
            f"ix_partner_portal_grants_{column}",
            "partner_portal_grants",
            [column],
        )

    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        SELECT 'partner_portal', 'Sponsored property-manager portal user', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'partner_portal')
        """
    )
    for plan_code, quota in PARTNER_PORTAL_QUOTAS.items():
        op.execute(
            sa.text(
                """
                INSERT INTO plan_entitlements (
                    plan_id, code, value_type, boolean_value, integer_value,
                    created_at, updated_at
                )
                SELECT subscription_plans.id, 'limits.partner_portals', 'integer',
                       NULL, :quota, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM subscription_plans
                WHERE subscription_plans.code = :plan_code
                  AND NOT EXISTS (
                    SELECT 1 FROM plan_entitlements
                    WHERE plan_entitlements.plan_id = subscription_plans.id
                      AND plan_entitlements.code = 'limits.partner_portals'
                  )
                """
            ).bindparams(plan_code=plan_code, quota=quota)
        )


def downgrade() -> None:
    op.execute("DELETE FROM plan_entitlements WHERE code = 'limits.partner_portals'")
    op.execute("DELETE FROM roles WHERE name = 'partner_portal'")
    for column in (
        "revoked_by_user_id",
        "granted_by_user_id",
        "expires_at",
        "status",
        "user_id",
        "collaboration_id",
        "partner_company_id",
        "host_company_id",
    ):
        op.drop_index(f"ix_partner_portal_grants_{column}", table_name="partner_portal_grants")
    op.drop_table("partner_portal_grants")
