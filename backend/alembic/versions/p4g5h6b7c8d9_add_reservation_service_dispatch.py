"""add reservation service dispatch

Revision ID: p4g5h6b7c8d9
Revises: o3f4g5a6b7c8
"""

from alembic import op
import sqlalchemy as sa


revision = "p4g5h6b7c8d9"
down_revision = "o3f4g5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reservations",
        sa.Column("assigned_company_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "reservations",
        sa.Column("cleaning_scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "reservations",
        sa.Column("service_request_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_reservations_assigned_company",
        "reservations",
        "companies",
        ["assigned_company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_reservations_assigned_company_id",
        "reservations",
        ["assigned_company_id"],
    )
    op.execute(
        """
        UPDATE reservations AS reservation
        SET assigned_company_id = users.company_id,
            cleaning_scheduled_at = task.scheduled_start_at,
            service_request_sent_at = task.created_at
        FROM task_items AS task
        JOIN users ON users.id = task.user_id
        WHERE task.checkout_reservation_id = reservation.id
          AND users.company_id <> reservation.owner_company_id
        """
    )
    op.execute(
        """
        UPDATE reservations AS reservation
        SET cleaning_scheduled_at = task.scheduled_start_at
        FROM task_items AS task
        WHERE task.checkout_reservation_id = reservation.id
          AND reservation.cleaning_scheduled_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_reservations_assigned_company_id", table_name="reservations")
    op.drop_constraint(
        "fk_reservations_assigned_company",
        "reservations",
        type_="foreignkey",
    )
    op.drop_column("reservations", "service_request_sent_at")
    op.drop_column("reservations", "cleaning_scheduled_at")
    op.drop_column("reservations", "assigned_company_id")
