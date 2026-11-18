"""Keep session revocation local to one company membership.

Revision ID: n1o2p3q4r5s
Revises: m0n1o2p3q4r
"""
from alembic import op
import sqlalchemy as sa

revision="n1o2p3q4r5s"
down_revision="m0n1o2p3q4r"
branch_labels=None
depends_on=None


def upgrade():
    op.add_column("company_memberships",sa.Column("session_version",sa.Integer(),nullable=False,server_default="0"))


def downgrade():
    with op.batch_alter_table("company_memberships") as batch:
        batch.drop_column("session_version")
