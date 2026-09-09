"""add service contracts derived from accepted quote revisions

Revision ID: m6n7o8p9q0r
Revises: l5m6n7o8p9q
"""

from alembic import op
import sqlalchemy as sa


revision = "m6n7o8p9q0r"
down_revision = "l5m6n7o8p9q"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "service_contracts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("contract_number", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "renewal_mode",
            sa.String(length=20),
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "renewal_notice_days",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column("response_time_hours", sa.Integer(), nullable=True),
        sa.Column("resolution_time_hours", sa.Integer(), nullable=True),
        sa.Column("service_window", sa.String(length=1000), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("quote_snapshot", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "source_quote_id",
            sa.Integer(),
            sa.ForeignKey("quotes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "source_quote_revision_id",
            sa.Integer(),
            sa.ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'terminated')",
            name="ck_service_contract_status",
        ),
        sa.CheckConstraint(
            "renewal_mode IN ('manual', 'automatic')",
            name="ck_service_contract_renewal_mode",
        ),
        sa.UniqueConstraint(
            "company_id",
            "contract_number",
            name="uq_company_service_contract_number",
        ),
        sa.UniqueConstraint("source_quote_id", name="uq_service_contract_source_quote"),
    )
    op.create_index(
        "ix_service_contracts_contract_number",
        "service_contracts",
        ["contract_number"],
    )
    op.create_index(
        "ix_service_contracts_status",
        "service_contracts",
        ["status"],
    )
    op.create_index(
        "ix_service_contracts_company_id",
        "service_contracts",
        ["company_id"],
    )
    op.create_index(
        "ix_service_contracts_client_id",
        "service_contracts",
        ["client_id"],
    )
    op.create_index(
        "ix_service_contracts_source_quote_id",
        "service_contracts",
        ["source_quote_id"],
    )
    op.create_index(
        "ix_service_contracts_source_quote_revision_id",
        "service_contracts",
        ["source_quote_revision_id"],
    )

    op.create_table(
        "service_contract_lines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "contract_id",
            sa.Integer(),
            sa.ForeignKey("service_contracts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.UniqueConstraint(
            "contract_id",
            "position",
            name="uq_service_contract_line_position",
        ),
    )
    op.create_index(
        "ix_service_contract_lines_contract_id",
        "service_contract_lines",
        ["contract_id"],
    )

    op.create_table(
        "service_contract_locations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "contract_id",
            sa.Integer(),
            sa.ForeignKey("service_contracts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "covered_from",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("covered_until", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "contract_id",
            "location_id",
            name="uq_service_contract_location",
        ),
    )
    op.create_index(
        "ix_service_contract_locations_contract_id",
        "service_contract_locations",
        ["contract_id"],
    )
    op.create_index(
        "ix_service_contract_locations_location_id",
        "service_contract_locations",
        ["location_id"],
    )

    op.create_table(
        "service_contract_location_zones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "contract_location_id",
            sa.Integer(),
            sa.ForeignKey("service_contract_locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "zone_id",
            sa.Integer(),
            sa.ForeignKey("location_zones.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "contract_location_id",
            "zone_id",
            name="uq_service_contract_location_zone",
        ),
    )
    op.create_index(
        "ix_service_contract_location_zones_contract_location_id",
        "service_contract_location_zones",
        ["contract_location_id"],
    )
    op.create_index(
        "ix_service_contract_location_zones_zone_id",
        "service_contract_location_zones",
        ["zone_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_service_contract_location_zones_zone_id",
        table_name="service_contract_location_zones",
    )
    op.drop_index(
        "ix_service_contract_location_zones_contract_location_id",
        table_name="service_contract_location_zones",
    )
    op.drop_table("service_contract_location_zones")

    op.drop_index(
        "ix_service_contract_locations_location_id",
        table_name="service_contract_locations",
    )
    op.drop_index(
        "ix_service_contract_locations_contract_id",
        table_name="service_contract_locations",
    )
    op.drop_table("service_contract_locations")

    op.drop_index(
        "ix_service_contract_lines_contract_id",
        table_name="service_contract_lines",
    )
    op.drop_table("service_contract_lines")

    op.drop_index(
        "ix_service_contracts_source_quote_revision_id",
        table_name="service_contracts",
    )
    op.drop_index(
        "ix_service_contracts_source_quote_id",
        table_name="service_contracts",
    )
    op.drop_index("ix_service_contracts_client_id", table_name="service_contracts")
    op.drop_index("ix_service_contracts_company_id", table_name="service_contracts")
    op.drop_index("ix_service_contracts_status", table_name="service_contracts")
    op.drop_index(
        "ix_service_contracts_contract_number",
        table_name="service_contracts",
    )
    op.drop_table("service_contracts")
