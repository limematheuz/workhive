"""add immutable service catalog versions

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n
"""

from alembic import op
import sqlalchemy as sa


revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("template_tasks") as batch:
        batch.add_column(
            sa.Column(
                "catalog_version",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch.add_column(sa.Column("estimated_duration_minutes", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("requirements", sa.String(length=2000), nullable=True))

    op.create_table(
        "service_catalog_versions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "template_task_id",
            sa.Integer(),
            sa.ForeignKey("template_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_price", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("pricing_mode", sa.String(length=20), nullable=False, server_default="fixed"),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("requirements", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0",
            name="ck_service_catalog_version_duration_positive",
        ),
        sa.CheckConstraint(
            "pricing_mode IN ('fixed', 'hourly')",
            name="ck_service_catalog_version_pricing_mode",
        ),
        sa.UniqueConstraint(
            "template_task_id",
            "version",
            name="uq_service_catalog_version_template_version",
        ),
    )
    op.create_index(
        "ix_service_catalog_versions_template_task_id",
        "service_catalog_versions",
        ["template_task_id"],
    )

    op.execute(
        """
        INSERT INTO service_catalog_versions (
            template_task_id, version, name, description, default_price, unit,
            pricing_mode, estimated_duration_minutes, requirements
        )
        SELECT id, catalog_version, name, description, default_price, unit,
               pricing_mode, estimated_duration_minutes, requirements
        FROM template_tasks
        """
    )

    with op.batch_alter_table("template_tasks") as batch:
        batch.alter_column("catalog_version", server_default=None)

    with op.batch_alter_table("service_catalog_versions") as batch:
        batch.alter_column("pricing_mode", server_default=None)


def downgrade() -> None:
    op.drop_index(
        "ix_service_catalog_versions_template_task_id",
        table_name="service_catalog_versions",
    )
    op.drop_table("service_catalog_versions")
    with op.batch_alter_table("template_tasks") as batch:
        batch.drop_column("requirements")
        batch.drop_column("estimated_duration_minutes")
        batch.drop_column("catalog_version")
