"""add reservations and location sharing

Revision ID: b4c2d8e1f6a0
Revises: 8574254e39fa
Create Date: 2026-06-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c2d8e1f6a0"
down_revision: Union[str, None] = "8574254e39fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "locations", sa.Column("managing_company_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_locations_managing_company",
        "locations",
        "companies",
        ["managing_company_id"],
        ["id"],
    )
    op.execute(
        """
        UPDATE locations
        SET managing_company_id = clients.company_id
        FROM clients
        WHERE locations.client_id = clients.id
        """
    )

    op.create_table(
        "location_company_access",
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column(
            "relationship_type",
            sa.String(length=30),
            server_default="service_provider",
            nullable=False,
        ),
        sa.Column(
            "can_manage_reservations", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column(
            "can_manage_tasks", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column(
            "can_view_sensitive", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "company_id"),
    )

    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("check_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("guest_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("stay_type", sa.String(length=20), server_default="guest", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="confirmed", nullable=False),
        sa.Column("source", sa.String(length=20), server_default="manual", nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "cleaning_required", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.CheckConstraint("guest_count >= 0", name="ck_reservations_guest_count"),
        sa.CheckConstraint("check_out_at > check_in_at", name="ck_reservations_dates"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_reservations_check_in_at"), "reservations", ["check_in_at"], unique=False
    )
    op.create_index(
        op.f("ix_reservations_check_out_at"), "reservations", ["check_out_at"], unique=False
    )

    op.add_column(
        "task_items", sa.Column("scheduled_start_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "task_items", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "task_items",
        sa.Column(
            "service_context",
            sa.String(length=30),
            server_default="standalone",
            nullable=False,
        ),
    )
    op.add_column(
        "task_items", sa.Column("checkout_reservation_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "task_items", sa.Column("next_reservation_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_task_items_checkout_reservation",
        "task_items",
        "reservations",
        ["checkout_reservation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_task_items_next_reservation",
        "task_items",
        "reservations",
        ["next_reservation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_task_items_next_reservation", "task_items", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_task_items_checkout_reservation", "task_items", type_="foreignkey"
    )
    op.drop_column("task_items", "next_reservation_id")
    op.drop_column("task_items", "checkout_reservation_id")
    op.drop_column("task_items", "service_context")
    op.drop_column("task_items", "due_at")
    op.drop_column("task_items", "scheduled_start_at")
    op.drop_index(op.f("ix_reservations_check_out_at"), table_name="reservations")
    op.drop_index(op.f("ix_reservations_check_in_at"), table_name="reservations")
    op.drop_table("reservations")
    op.drop_table("location_company_access")
    op.drop_constraint(
        "fk_locations_managing_company", "locations", type_="foreignkey"
    )
    op.drop_column("locations", "managing_company_id")
