"""Retire external invitations and sessions before enabling native sign-in."""
from alembic import op
import sqlalchemy as sa

revision = "r5s6t7u8v9w0"
down_revision = "q4r5s6t7u8v9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("platform_invitations", sa.Column("token_digest", sa.String(64), unique=True))
    op.execute("UPDATE platform_invitations SET expires_at = 0 WHERE member_id IS NULL")
    op.execute("UPDATE users SET session_version = session_version + 1 WHERE platform_oidc_subject IS NOT NULL")


def downgrade():
    op.drop_column("platform_invitations", "token_digest")
