"""add task company ownership and nullable assignee

Revision ID: t8k9l0m1n2o3
Revises: s7j8k9l0m1n2
"""

from alembic import op
import sqlalchemy as sa


revision = "t8k9l0m1n2o3"
down_revision = "s7j8k9l0m1n2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_items",
        sa.Column("company_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_task_items_company_id",
        "task_items",
        "companies",
        ["company_id"],
        ["id"],
    )

    op.execute(
        sa.text(
            """
            UPDATE task_items AS task
            SET company_id = users.company_id
            FROM users
            WHERE task.user_id = users.id
              AND users.company_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE task_items AS task
            SET company_id = COALESCE(
                locations.owner_company_id,
                locations.managing_company_id,
                clients.company_id
            )
            FROM locations
            LEFT JOIN clients ON clients.id = locations.client_id
            WHERE task.location_id = locations.id
              AND task.company_id IS NULL
            """
        )
    )

    op.alter_column(
        "task_items",
        "company_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "task_items",
        "user_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_index(
        "ix_task_items_company_id",
        "task_items",
        ["company_id"],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE task_items AS task
            SET user_id = (
                SELECT users.id
                FROM users
                WHERE users.company_id = task.company_id
                ORDER BY users.id
                LIMIT 1
            )
            WHERE task.user_id IS NULL
            """
        )
    )
    op.alter_column(
        "task_items",
        "user_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_index("ix_task_items_company_id", table_name="task_items")
    op.drop_constraint(
        "fk_task_items_company_id",
        "task_items",
        type_="foreignkey",
    )
    op.drop_column("task_items", "company_id")
