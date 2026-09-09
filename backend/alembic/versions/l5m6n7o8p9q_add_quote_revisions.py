"""add immutable quote revisions

Revision ID: l5m6n7o8p9q
Revises: k4l5m6n7o8p
"""

from alembic import op
import sqlalchemy as sa


revision = "l5m6n7o8p9q"
down_revision = "k4l5m6n7o8p"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quote_revisions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "quote_id",
            sa.Integer(),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("quote_id", "version", name="uq_quote_revision_version"),
    )
    op.create_index("ix_quote_revisions_quote_id", "quote_revisions", ["quote_id"])
    op.create_index("ix_quote_revisions_company_id", "quote_revisions", ["company_id"])

    with op.batch_alter_table("quotes") as batch:
        batch.add_column(
            sa.Column(
                "revision_number",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch.add_column(sa.Column("accepted_revision_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_quotes_accepted_revision",
            "quote_revisions",
            ["accepted_revision_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("quotes") as batch:
        batch.drop_constraint("fk_quotes_accepted_revision", type_="foreignkey")
        batch.drop_column("accepted_revision_id")
        batch.drop_column("revision_number")

    op.drop_index("ix_quote_revisions_company_id", table_name="quote_revisions")
    op.drop_index("ix_quote_revisions_quote_id", table_name="quote_revisions")
    op.drop_table("quote_revisions")
