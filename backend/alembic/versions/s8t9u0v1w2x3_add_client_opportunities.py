"""add client commercial opportunities and activities

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2
"""

from alembic import op
import sqlalchemy as sa


revision = "s8t9u0v1w2x3"
down_revision = "r7s8t9u0v1w2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_opportunities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            sa.Integer(),
            sa.ForeignKey("client_contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "owner_membership_id",
            sa.Integer(),
            sa.ForeignKey("company_memberships.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loss_reason", sa.String(length=500), nullable=True),
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
            "stage IN ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')",
            name="ck_client_opportunity_stage",
        ),
    )
    op.create_index("ix_client_opportunities_client_id", "client_opportunities", ["client_id"])
    op.create_index("ix_client_opportunities_contact_id", "client_opportunities", ["contact_id"])
    op.create_index("ix_client_opportunities_owner_membership_id", "client_opportunities", ["owner_membership_id"])
    op.create_index("ix_client_opportunities_created_by_user_id", "client_opportunities", ["created_by_user_id"])
    op.create_index("ix_client_opportunities_stage", "client_opportunities", ["stage"])
    op.create_index("ix_client_opportunities_next_follow_up_at", "client_opportunities", ["next_follow_up_at"])
    op.create_index("ix_client_opportunities_is_active", "client_opportunities", ["is_active"])

    op.create_table(
        "client_opportunity_activities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "opportunity_id",
            sa.Integer(),
            sa.ForeignKey("client_opportunities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("activity_type", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("stage_from", sa.String(length=20), nullable=True),
        sa.Column("stage_to", sa.String(length=20), nullable=True),
        sa.Column(
            "happened_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change')",
            name="ck_client_opportunity_activity_type",
        ),
    )
    op.create_index(
        "ix_client_opportunity_activities_opportunity_id",
        "client_opportunity_activities",
        ["opportunity_id"],
    )
    op.create_index(
        "ix_client_opportunity_activities_created_by_user_id",
        "client_opportunity_activities",
        ["created_by_user_id"],
    )
    op.create_index(
        "ix_client_opportunity_activities_activity_type",
        "client_opportunity_activities",
        ["activity_type"],
    )
    op.create_index(
        "ix_client_opportunity_activities_happened_at",
        "client_opportunity_activities",
        ["happened_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_client_opportunity_activities_happened_at",
        table_name="client_opportunity_activities",
    )
    op.drop_index(
        "ix_client_opportunity_activities_activity_type",
        table_name="client_opportunity_activities",
    )
    op.drop_index(
        "ix_client_opportunity_activities_created_by_user_id",
        table_name="client_opportunity_activities",
    )
    op.drop_index(
        "ix_client_opportunity_activities_opportunity_id",
        table_name="client_opportunity_activities",
    )
    op.drop_table("client_opportunity_activities")
    op.drop_index("ix_client_opportunities_is_active", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_next_follow_up_at", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_stage", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_created_by_user_id", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_owner_membership_id", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_contact_id", table_name="client_opportunities")
    op.drop_index("ix_client_opportunities_client_id", table_name="client_opportunities")
    op.drop_table("client_opportunities")
