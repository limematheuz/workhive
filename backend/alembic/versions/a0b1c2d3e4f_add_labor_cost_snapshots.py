"""add confidential labour-cost history and session snapshots

Revision ID: a0b1c2d3e4f
Revises: x9y0z1a2b3c
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "a0b1c2d3e4f"
down_revision = "x9y0z1a2b3c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "labor_cost_rates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("company_membership_id", sa.Integer(), nullable=False),
        sa.Column("hourly_cost", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("effective_on", sa.Date(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "hourly_cost >= 0", name="ck_labor_cost_rates_non_negative"
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_labor_cost_rate_membership_company",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_membership_id",
            "effective_on",
            name="uq_labor_cost_rate_membership_effective_on",
        ),
    )
    op.create_index("ix_labor_cost_rates_company_id", "labor_cost_rates", ["company_id"])
    op.create_index(
        "ix_labor_cost_rates_company_membership_id",
        "labor_cost_rates",
        ["company_membership_id"],
    )
    op.create_index(
        "ix_labor_cost_rates_effective_on", "labor_cost_rates", ["effective_on"]
    )

    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_company_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_membership_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_rate_snapshot", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_amount_snapshot", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.create_foreign_key(
        "fk_work_sessions_labor_cost_company",
        "work_sessions",
        "companies",
        ["labor_cost_company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_work_sessions_labor_cost_company_id",
        "work_sessions",
        ["labor_cost_company_id"],
    )
    op.create_index(
        "ix_work_sessions_labor_cost_membership_id",
        "work_sessions",
        ["labor_cost_membership_id"],
    )

    permission_definitions = sa.table(
        "permission_definitions",
        sa.column("code", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        permission_definitions,
        [
            {
                "code": "labor_costs.read",
                "category": "finance",
                "description": "View confidential internal labour costs",
                "is_active": True,
            },
            {
                "code": "labor_costs.manage",
                "category": "finance",
                "description": "Set confidential internal labour costs",
                "is_active": True,
            },
        ],
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('labor_costs.read', 'labor_costs.manage')
        WHERE profiles.name = 'Administrador de empresa'
          AND NOT EXISTS (
            SELECT 1
            FROM permission_profile_permissions AS existing
            WHERE existing.permission_profile_id = profiles.id
              AND existing.permission_definition_id = definitions.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM permission_profile_permissions
        WHERE permission_definition_id IN (
            SELECT id FROM permission_definitions
            WHERE code IN ('labor_costs.read', 'labor_costs.manage')
        )
        """
    )
    op.execute(
        "DELETE FROM permission_definitions "
        "WHERE code IN ('labor_costs.read', 'labor_costs.manage')"
    )
    op.drop_index(
        "ix_work_sessions_labor_cost_membership_id", table_name="work_sessions"
    )
    op.drop_index(
        "ix_work_sessions_labor_cost_company_id", table_name="work_sessions"
    )
    op.drop_constraint(
        "fk_work_sessions_labor_cost_company", "work_sessions", type_="foreignkey"
    )
    op.drop_column("work_sessions", "labor_cost_amount_snapshot")
    op.drop_column("work_sessions", "labor_cost_rate_snapshot")
    op.drop_column("work_sessions", "labor_cost_membership_id")
    op.drop_column("work_sessions", "labor_cost_company_id")
    op.drop_index("ix_labor_cost_rates_effective_on", table_name="labor_cost_rates")
    op.drop_index(
        "ix_labor_cost_rates_company_membership_id", table_name="labor_cost_rates"
    )
    op.drop_index("ix_labor_cost_rates_company_id", table_name="labor_cost_rates")
    op.drop_table("labor_cost_rates")
