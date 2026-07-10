"""add company partner_code and collaborations table

Revision ID: c011ab01e001
Revises: b4c2d8e1f6a0
Create Date: 2026-06-05 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c011ab01e001"
down_revision: Union[str, None] = "b4c2d8e1f6a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add partner_code to companies
    op.add_column("companies", sa.Column("partner_code", sa.String(length=50), nullable=True))
    op.create_index(op.f("ix_companies_partner_code"), "companies", ["partner_code"], unique=True)

    # 2. Create company_collaborations table
    op.create_table(
        "company_collaborations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("initiator_company_id", sa.Integer(), nullable=False),
        sa.Column("partner_company_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("role_type", sa.String(length=30), nullable=False, server_default="service_provider"),
        sa.Column("token", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["initiator_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("initiator_company_id", "partner_company_id", name="uq_company_collaboration")
    )
    op.create_index(op.f("ix_company_collaborations_initiator_company_id"), "company_collaborations", ["initiator_company_id"], unique=False)
    op.create_index(op.f("ix_company_collaborations_partner_company_id"), "company_collaborations", ["partner_company_id"], unique=False)
    op.create_index(op.f("ix_company_collaborations_status"), "company_collaborations", ["status"], unique=False)
    op.create_index(op.f("ix_company_collaborations_token"), "company_collaborations", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_company_collaborations_token"), table_name="company_collaborations")
    op.drop_index(op.f("ix_company_collaborations_status"), table_name="company_collaborations")
    op.drop_index(op.f("ix_company_collaborations_partner_company_id"), table_name="company_collaborations")
    op.drop_index(op.f("ix_company_collaborations_initiator_company_id"), table_name="company_collaborations")
    op.drop_table("company_collaborations")
    
    sa_idx = op.f("ix_companies_partner_code")
    op.drop_index(sa_idx, table_name="companies")
    op.drop_column("companies", "partner_code")
