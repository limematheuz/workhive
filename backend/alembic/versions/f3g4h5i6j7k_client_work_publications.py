"""Explicit customer publication and validation of execution reports."""
from alembic import op
import sqlalchemy as sa

revision = "f3g4h5i6j7k"
down_revision = "e2f3g4h5i6j"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("task_client_publications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("task_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("manifest", sa.JSON(), nullable=False),
        sa.Column("manifest_hash", sa.String(64), nullable=False),
        sa.Column("published_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.UniqueConstraint("task_id", "revision", name="uq_task_client_publication_revision"),
        sa.ForeignKeyConstraint(["client_id", "company_id"], ["clients.id", "clients.company_id"], ondelete="CASCADE", name="fk_task_client_publication_customer"),
        sa.CheckConstraint("revision > 0", name="ck_task_client_publication_revision"))
    for column in ("company_id", "client_id", "location_id", "task_id"):
        op.create_index(f"ix_task_client_publications_{column}", "task_client_publications", [column])
    op.create_table("task_client_publication_photos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("publication_id", sa.Integer(), sa.ForeignKey("task_client_publications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_report_id", sa.Integer(), sa.ForeignKey("task_reports.id", ondelete="SET NULL")),
        sa.Column("media_key", sa.String(500), unique=True, nullable=False),
        sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False))
    op.create_index("ix_task_client_publication_photos_publication_id", "task_client_publication_photos", ["publication_id"])
    op.create_table("task_client_acceptances",
        sa.Column("publication_id", sa.Integer(), sa.ForeignKey("task_client_publications.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("grant_id", sa.Integer(), sa.ForeignKey("client_portal_grants.id", ondelete="SET NULL")),
        sa.Column("accepted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("signer_name", sa.String(255), nullable=False),
        sa.Column("statement_version", sa.String(80), nullable=False),
        sa.Column("manifest_hash", sa.String(64), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table("task_client_acceptances")
    op.drop_table("task_client_publication_photos")
    op.drop_table("task_client_publications")
