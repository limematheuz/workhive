"""add consumed security tokens for one-time JWTs

Revision ID: a7b8c9d0e1f2
Revises: c2d3e4f5g6h7
"""

from alembic import op
import sqlalchemy as sa


revision = "a7b8c9d0e1f2"
down_revision = "c2d3e4f5g6h7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consumed_security_tokens",
        sa.Column("jti", sa.String(length=64), primary_key=True),
        sa.Column("purpose", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_consumed_security_tokens_purpose",
        "consumed_security_tokens",
        ["purpose"],
    )
    op.create_index(
        "ix_consumed_security_tokens_expires_at",
        "consumed_security_tokens",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_consumed_security_tokens_expires_at",
        table_name="consumed_security_tokens",
    )
    op.drop_index(
        "ix_consumed_security_tokens_purpose",
        table_name="consumed_security_tokens",
    )
    op.drop_table("consumed_security_tokens")
