"""add location documents and equipment

Revision ID: s4t5u6v7w8x
Revises: r3s4t5u6v7w
"""

from alembic import op
import sqlalchemy as sa


revision = "s4t5u6v7w8x"
down_revision = "r3s4t5u6v7w"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "location_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("document_type", sa.String(length=40), nullable=False, server_default="other"),
        sa.Column("storage_key", sa.String(length=500), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_location_documents_company_id", "location_documents", ["company_id"])
    op.create_index("ix_location_documents_location_id", "location_documents", ["location_id"])
    op.create_index("ix_location_documents_document_type", "location_documents", ["document_type"])
    op.create_table(
        "location_equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False, server_default="other"),
        sa.Column("serial_number", sa.String(length=120), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("next_service_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_location_equipment_quantity_positive"),
        sa.CheckConstraint("status IN ('active', 'maintenance', 'retired')", name="ck_location_equipment_status"),
    )
    op.create_index("ix_location_equipment_company_id", "location_equipment", ["company_id"])
    op.create_index("ix_location_equipment_location_id", "location_equipment", ["location_id"])
    op.create_index("ix_location_equipment_category", "location_equipment", ["category"])
    op.create_index("ix_location_equipment_status", "location_equipment", ["status"])
    op.create_index("ix_location_equipment_is_active", "location_equipment", ["is_active"])


def downgrade() -> None:
    op.drop_table("location_equipment")
    op.drop_table("location_documents")
