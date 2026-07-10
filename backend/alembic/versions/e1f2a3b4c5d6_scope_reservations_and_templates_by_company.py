"""scope reservations and templates by company

Revision ID: e1f2a3b4c5d6
Revises: d022bc02e002
Create Date: 2026-06-06 14:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d022bc02e002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reservations",
        sa.Column("owner_company_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_reservations_owner_company",
        "reservations",
        "companies",
        ["owner_company_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.execute(
        """
        UPDATE reservations
        SET owner_company_id = users.company_id
        FROM users
        WHERE reservations.created_by_user_id = users.id
          AND reservations.owner_company_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE reservations
        SET owner_company_id = clients.company_id
        FROM locations
        JOIN clients ON clients.id = locations.client_id
        WHERE reservations.location_id = locations.id
          AND reservations.owner_company_id IS NULL
        """
    )
    op.alter_column("reservations", "owner_company_id", nullable=False)
    op.create_index(
        "ix_reservations_owner_company_id",
        "reservations",
        ["owner_company_id"],
        unique=False,
    )

    op.add_column(
        "template_tasks",
        sa.Column("company_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_template_tasks_company",
        "template_tasks",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE template_tasks
        SET company_id = task_companies.company_id
        FROM (
            SELECT task_items.template_task_id, MIN(users.company_id) AS company_id
            FROM task_items
            JOIN users ON users.id = task_items.user_id
            WHERE task_items.template_task_id IS NOT NULL
              AND users.company_id IS NOT NULL
            GROUP BY task_items.template_task_id
        ) AS task_companies
        WHERE template_tasks.id = task_companies.template_task_id
          AND template_tasks.company_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE template_tasks
        SET company_id = location_companies.company_id
        FROM (
            SELECT location_templates.template_task_id,
                   MIN(clients.company_id) AS company_id
            FROM location_templates
            JOIN locations ON locations.id = location_templates.location_id
            JOIN clients ON clients.id = locations.client_id
            GROUP BY location_templates.template_task_id
        ) AS location_companies
        WHERE template_tasks.id = location_companies.template_task_id
          AND template_tasks.company_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE template_tasks
        SET company_id = (SELECT MIN(id) FROM companies)
        WHERE company_id IS NULL
        """
    )
    op.alter_column("template_tasks", "company_id", nullable=False)
    op.create_index(
        "ix_template_tasks_company_id",
        "template_tasks",
        ["company_id"],
        unique=False,
    )

    inspector = sa.inspect(op.get_bind())
    for constraint in inspector.get_unique_constraints("template_tasks"):
        if constraint.get("column_names") == ["name"] and constraint.get("name"):
            op.drop_constraint(
                constraint["name"],
                "template_tasks",
                type_="unique",
            )
    op.create_unique_constraint(
        "uq_template_tasks_company_name",
        "template_tasks",
        ["company_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_template_tasks_company_name",
        "template_tasks",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_template_tasks_name",
        "template_tasks",
        ["name"],
    )
    op.drop_index("ix_template_tasks_company_id", table_name="template_tasks")
    op.drop_constraint(
        "fk_template_tasks_company",
        "template_tasks",
        type_="foreignkey",
    )
    op.drop_column("template_tasks", "company_id")

    op.drop_index("ix_reservations_owner_company_id", table_name="reservations")
    op.drop_constraint(
        "fk_reservations_owner_company",
        "reservations",
        type_="foreignkey",
    )
    op.drop_column("reservations", "owner_company_id")
