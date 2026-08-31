"""add invitation rejoin identity

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
"""

from alembic import op
import sqlalchemy as sa


revision = "q6r7s8t9u0v1"
down_revision = "p5q6r7s8t9u0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_invitations") as batch:
        batch.add_column(sa.Column("rejoin_user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_user_invitations_rejoin_user",
            "users",
            ["rejoin_user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index(
            "ix_user_invitations_rejoin_user_id", ["rejoin_user_id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("user_invitations") as batch:
        batch.drop_index("ix_user_invitations_rejoin_user_id")
        batch.drop_constraint("fk_user_invitations_rejoin_user", type_="foreignkey")
        batch.drop_column("rejoin_user_id")
