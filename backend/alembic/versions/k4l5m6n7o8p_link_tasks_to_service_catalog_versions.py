"""link tasks to immutable service catalog versions

Revision ID: k4l5m6n7o8p
Revises: j3k4l5m6n7o8
"""

from alembic import op
import sqlalchemy as sa


revision = "k4l5m6n7o8p"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.add_column(
            sa.Column(
                "service_catalog_version_id",
                sa.Integer(),
                nullable=True,
            )
        )
        batch.create_foreign_key(
            "fk_task_items_service_catalog_version",
            "service_catalog_versions",
            ["service_catalog_version_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index(
        "ix_task_items_service_catalog_version_id",
        "task_items",
        ["service_catalog_version_id"],
    )

    # Old work already keeps its operational and billing snapshots. When it
    # has a service reference, connect it to the matching catalog snapshot for
    # traceability without rewriting any commercial field.
    op.execute(
        """
        UPDATE task_items
        SET service_catalog_version_id = (
            SELECT service_catalog_versions.id
            FROM service_catalog_versions
            JOIN template_tasks
              ON template_tasks.id = service_catalog_versions.template_task_id
            WHERE service_catalog_versions.template_task_id = task_items.template_task_id
              AND service_catalog_versions.version = template_tasks.catalog_version
        )
        WHERE template_task_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_task_items_service_catalog_version_id",
        table_name="task_items",
    )
    with op.batch_alter_table("task_items") as batch:
        batch.drop_constraint(
            "fk_task_items_service_catalog_version",
            type_="foreignkey",
        )
        batch.drop_column("service_catalog_version_id")
