from alembic import op
import sqlalchemy as sa

revision = "q4r5s6t7u8v9"
down_revision = "p3q4r5s6t7u8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "platform_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("issuer", sa.String(512), nullable=False),
        sa.Column("invited_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("users.id"), unique=True),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("revoked_by", sa.Integer(), sa.ForeignKey("users.id")),
    )


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM platform_invitations LIMIT 1")).scalar():
        raise RuntimeError("Preserve platform access grants before downgrading")
    op.drop_table("platform_invitations")
