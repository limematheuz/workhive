"""Retire external invitations and sessions before enabling native sign-in."""
from alembic import op
import sqlalchemy as sa

revision = "r5s6t7u8v9w0"
down_revision = "q4r5s6t7u8v9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("platform_invitations") as batch:
        batch.add_column(sa.Column("token_digest", sa.String(64)))
        batch.create_unique_constraint("platform_invitations_token_digest_key", ["token_digest"])
    op.execute("UPDATE platform_invitations SET expires_at = 0 WHERE member_id IS NULL")
    op.execute("UPDATE users SET session_version = session_version + 1 WHERE platform_oidc_subject IS NOT NULL")


def downgrade():
    with op.batch_alter_table("platform_invitations") as batch:
        batch.drop_constraint("platform_invitations_token_digest_key", type_="unique")
        batch.drop_column("token_digest")
