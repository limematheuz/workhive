"""add commercial account lifecycle and client contacts

Revision ID: r7s8t9u0v1w2
Revises: q6r7s8t9u0v1
"""

from alembic import op
import sqlalchemy as sa


revision = "r7s8t9u0v1w2"
down_revision = "q6r7s8t9u0v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("clients") as batch:
        batch.add_column(
            sa.Column(
                "relationship_status",
                sa.String(length=20),
                nullable=False,
                server_default="client",
            )
        )
        batch.create_check_constraint(
            "ck_client_relationship_status",
            "relationship_status IN ('lead', 'client')",
        )
        batch.create_index(
            "ix_clients_relationship_status", ["relationship_status"], unique=False
        )

    op.create_table(
        "client_contacts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("job_title", sa.String(length=120), nullable=True),
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
    )
    op.create_index("ix_client_contacts_client_id", "client_contacts", ["client_id"])
    op.create_index("ix_client_contacts_email", "client_contacts", ["email"])
    op.create_index("ix_client_contacts_is_primary", "client_contacts", ["is_primary"])
    op.create_index("ix_client_contacts_is_active", "client_contacts", ["is_active"])
    op.create_index(
        "uq_client_contacts_primary",
        "client_contacts",
        ["client_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
        sqlite_where=sa.text("is_primary = 1"),
    )

    op.create_table(
        "client_contact_roles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "client_contact_id",
            sa.Integer(),
            sa.ForeignKey("client_contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.CheckConstraint(
            "role IN ('commercial', 'billing', 'operations', 'quality', 'emergency', 'general')",
            name="ck_client_contact_role_value",
        ),
        sa.UniqueConstraint(
            "client_contact_id", "role", name="uq_client_contact_role"
        ),
    )
    op.create_index(
        "ix_client_contact_roles_client_contact_id",
        "client_contact_roles",
        ["client_contact_id"],
    )
    op.create_index("ix_client_contact_roles_role", "client_contact_roles", ["role"])

    # Preserve every existing reachable client detail as a general primary
    # contact. No commercial responsibility is inferred from legacy data.
    op.execute(
        """
        INSERT INTO client_contacts (
            client_id, full_name, email, phone, is_primary, is_active
        )
        SELECT
            id,
            name,
            NULLIF(email, ''),
            NULLIF(phone, ''),
            TRUE,
            TRUE
        FROM clients
        WHERE NULLIF(email, '') IS NOT NULL OR NULLIF(phone, '') IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_client_contact_roles_role", table_name="client_contact_roles")
    op.drop_index(
        "ix_client_contact_roles_client_contact_id", table_name="client_contact_roles"
    )
    op.drop_table("client_contact_roles")
    op.drop_index("uq_client_contacts_primary", table_name="client_contacts")
    op.drop_index("ix_client_contacts_is_active", table_name="client_contacts")
    op.drop_index("ix_client_contacts_is_primary", table_name="client_contacts")
    op.drop_index("ix_client_contacts_email", table_name="client_contacts")
    op.drop_index("ix_client_contacts_client_id", table_name="client_contacts")
    op.drop_table("client_contacts")
    with op.batch_alter_table("clients") as batch:
        batch.drop_index("ix_clients_relationship_status")
        batch.drop_constraint("ck_client_relationship_status", type_="check")
        batch.drop_column("relationship_status")
