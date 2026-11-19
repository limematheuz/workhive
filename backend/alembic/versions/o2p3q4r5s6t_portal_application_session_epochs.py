"""Keep application context revocation local to its portal grant.

Revision ID: o2p3q4r5s6t
Revises: n1o2p3q4r5s
"""
from alembic import op
import sqlalchemy as sa

revision = "o2p3q4r5s6t"
down_revision = "n1o2p3q4r5s"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("client_portal_grants", "external_access_grants"):
        op.add_column(table, sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    for table in ("external_access_grants", "client_portal_grants"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("session_version")
