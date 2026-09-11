"""add operational contacts per location

Revision ID: n7o8p9q0r1s
Revises: m6n7o8p9q0r
"""

from alembic import op
import sqlalchemy as sa


revision = "n7o8p9q0r1s"
down_revision = "m6n7o8p9q0r"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "location_contacts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("role", sa.String(length=30), nullable=False, server_default="general"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('operations', 'access', 'emergency', 'quality', 'general')",
            name="ck_location_contact_role",
        ),
    )
    op.create_index("ix_location_contacts_location_id", "location_contacts", ["location_id"])
    op.create_index("ix_location_contacts_role", "location_contacts", ["role"])
    op.create_index("ix_location_contacts_is_active", "location_contacts", ["is_active"])

    bind = op.get_bind()
    if "location_profiles" in sa.inspect(bind).get_table_names():
        op.execute(
            sa.text(
                """
                INSERT INTO location_contacts
                    (location_id, full_name, email, phone, role, is_primary, is_active)
                SELECT
                    location_id,
                    contact_name,
                    contact_email,
                    contact_phone,
                    'general',
                    true,
                    true
                FROM location_profiles
                WHERE contact_name IS NOT NULL
                  AND trim(contact_name) <> ''
                  AND (
                    (contact_email IS NOT NULL AND trim(contact_email) <> '')
                    OR (contact_phone IS NOT NULL AND trim(contact_phone) <> '')
                  )
                """
            )
        )


def downgrade() -> None:
    op.drop_index("ix_location_contacts_is_active", table_name="location_contacts")
    op.drop_index("ix_location_contacts_role", table_name="location_contacts")
    op.drop_index("ix_location_contacts_location_id", table_name="location_contacts")
    op.drop_table("location_contacts")
