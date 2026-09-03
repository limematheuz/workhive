"""add client commercial account assignments

Revision ID: g0h1i2j3k4l5
Revises: f9a0b1c2d3e4
"""

from alembic import op
import sqlalchemy as sa


revision = "g0h1i2j3k4l5"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("clients") as batch:
        batch.create_unique_constraint("uq_client_id_company", ["id", "company_id"])

    op.create_table(
        "client_account_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("company_membership_id", sa.Integer(), nullable=False),
        sa.Column(
            "assigned_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_client_account_assignment_dates",
        ),
        sa.UniqueConstraint(
            "id",
            "company_id",
            name="uq_client_account_assignment_id_company",
        ),
        sa.ForeignKeyConstraint(
            ["client_id", "company_id"],
            ["clients.id", "clients.company_id"],
            ondelete="CASCADE",
            name="fk_client_account_assignment_client_company",
        ),
        sa.ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="RESTRICT",
            name="fk_client_account_assignment_membership_company",
        ),
    )
    op.create_index(
        "ix_client_account_assignments_company_id",
        "client_account_assignments",
        ["company_id"],
    )
    op.create_index(
        "ix_client_account_assignments_client_id",
        "client_account_assignments",
        ["client_id"],
    )
    op.create_index(
        "ix_client_account_assignments_company_membership_id",
        "client_account_assignments",
        ["company_membership_id"],
    )
    op.create_index(
        "ix_client_account_assignments_assigned_by_user_id",
        "client_account_assignments",
        ["assigned_by_user_id"],
    )
    op.create_index(
        "ix_client_account_assignments_started_at",
        "client_account_assignments",
        ["started_at"],
    )
    op.create_index(
        "ix_client_account_assignments_ended_at",
        "client_account_assignments",
        ["ended_at"],
    )
    op.create_index(
        "uq_client_account_assignment_current_client",
        "client_account_assignments",
        ["client_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_client_account_assignment_current_client",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_ended_at",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_started_at",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_assigned_by_user_id",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_company_membership_id",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_client_id",
        table_name="client_account_assignments",
    )
    op.drop_index(
        "ix_client_account_assignments_company_id",
        table_name="client_account_assignments",
    )
    op.drop_table("client_account_assignments")
    with op.batch_alter_table("clients") as batch:
        batch.drop_constraint("uq_client_id_company", type_="unique")
