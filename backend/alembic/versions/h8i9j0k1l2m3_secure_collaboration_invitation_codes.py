"""secure collaboration invitations and retire partner codes

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""

from alembic import op
import sqlalchemy as sa


revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "company_collaboration_invitations",
        sa.Column("verification_code_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_company_collaboration_invitations_verification_code_hash"),
        "company_collaboration_invitations",
        ["verification_code_hash"],
        unique=True,
    )
    op.drop_index(op.f("ix_companies_partner_code"), table_name="companies")
    op.drop_column("companies", "partner_code")


def downgrade() -> None:
    op.add_column("companies", sa.Column("partner_code", sa.String(length=50), nullable=True))
    op.create_index(op.f("ix_companies_partner_code"), "companies", ["partner_code"], unique=True)
    op.drop_index(
        op.f("ix_company_collaboration_invitations_verification_code_hash"),
        table_name="company_collaboration_invitations",
    )
    op.drop_column("company_collaboration_invitations", "verification_code_hash")
