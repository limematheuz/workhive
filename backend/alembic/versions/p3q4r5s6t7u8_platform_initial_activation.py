"""Store the platform identity and permanently close first-account enrollment."""

from alembic import op
import sqlalchemy as sa


revision = "p3q4r5s6t7u8"
down_revision = "o2p3q4r5s6t"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("platform_oidc_issuer", sa.String(512), nullable=True))
    op.add_column("users", sa.Column("platform_oidc_subject", sa.String(255), nullable=True))
    op.create_unique_constraint(
        "uq_users_platform_oidc_identity", "users", ["platform_oidc_issuer", "platform_oidc_subject"]
    )
    op.create_check_constraint(
        "ck_users_platform_oidc_identity",
        "users",
        "(platform_oidc_issuer IS NULL AND platform_oidc_subject IS NULL) OR "
        "(platform_oidc_issuer IS NOT NULL AND platform_oidc_subject IS NOT NULL AND company_id IS NULL)",
    )
    op.create_table(
        "platform_setup",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_platform_setup_singleton"),
    )


def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT 1 FROM platform_setup WHERE id = 1")).scalar():
        raise RuntimeError("Platform setup has been completed. Preserve the linked identities before downgrading.")
    op.drop_table("platform_setup")
    op.drop_constraint("ck_users_platform_oidc_identity", "users", type_="check")
    op.drop_constraint("uq_users_platform_oidc_identity", "users", type_="unique")
    op.drop_column("users", "platform_oidc_subject")
    op.drop_column("users", "platform_oidc_issuer")
