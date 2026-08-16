"""add fiscal calendar preferences

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
"""

from alembic import op
import sqlalchemy as sa


revision = "i6j7k8l9m0n1"
down_revision = "h5i6j7k8l9m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "company_fiscal_settings",
        sa.Column(
            "quarterly_vat_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "company_fiscal_settings",
        sa.Column(
            "quarterly_withholding_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "company_fiscal_settings",
        sa.Column(
            "fiscal_reminder_days",
            sa.Integer(),
            nullable=False,
            server_default="7",
        ),
    )
    op.create_check_constraint(
        "ck_company_fiscal_settings_reminder_days",
        "company_fiscal_settings",
        "fiscal_reminder_days BETWEEN 1 AND 30",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_company_fiscal_settings_reminder_days",
        "company_fiscal_settings",
        type_="check",
    )
    op.drop_column("company_fiscal_settings", "fiscal_reminder_days")
    op.drop_column("company_fiscal_settings", "quarterly_withholding_enabled")
    op.drop_column("company_fiscal_settings", "quarterly_vat_enabled")
