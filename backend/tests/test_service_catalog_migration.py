from alembic import command
from alembic.config import Config
from sqlalchemy import (
    Boolean,
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    inspect,
    text,
)

from app.core.config import settings


def test_service_catalog_revision_backfills_existing_templates(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'catalog-migration.db'}"
    monkeypatch.setattr(settings, "MIGRATION_DATABASE_URL", database_url)

    metadata = MetaData()
    template_tasks = Table(
        "template_tasks",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String(50), nullable=False),
        Column("description", String(255)),
        Column("default_price", Float),
        Column("unit", String(50), nullable=False),
        Column("pricing_mode", String(20), nullable=False),
        Column("is_active", Integer, nullable=False),
        Column("company_id", Integer, nullable=False),
    )
    task_items = Table(
        "task_items",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("template_task_id", Integer, nullable=True),
    )
    # These are established tables at the historical revision under test.
    # They let the fixture exercise migrations all the way to the current head
    # without pretending that later additions already exist.
    Table("companies", metadata, Column("id", Integer, primary_key=True))
    Table(
        "clients",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("company_id", Integer, nullable=False),
    )
    Table("locations", metadata, Column("id", Integer, primary_key=True))
    Table(
        "reservations",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("owner_company_id", Integer, nullable=False),
        Column("source", String(50), nullable=False),
        Column("external_reference", String(255), nullable=True),
    )
    Table("users", metadata, Column("id", Integer, primary_key=True))
    Table(
        "roles",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String(255), nullable=False),
        Column("description", String(500), nullable=False),
        Column("is_active", Boolean, nullable=False),
    )
    Table("work_sessions", metadata, Column("id", Integer, primary_key=True))
    Table(
        "notifications",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=False),
        Column("event_type", String(100), nullable=False),
        Column("entity_type", String(100), nullable=False),
        Column("entity_id", Integer, nullable=False),
        Column("metadata_json", String(1000), nullable=True),
    )
    Table(
        "permission_definitions",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("code", String(255), nullable=False),
        Column("category", String(255), nullable=False),
        Column("description", String(500), nullable=False),
        Column("is_active", Boolean, nullable=False),
    )
    Table(
        "permission_profiles",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String(255), nullable=False),
    )
    Table(
        "permission_profile_permissions",
        metadata,
        Column("permission_profile_id", Integer, primary_key=True),
        Column("permission_definition_id", Integer, primary_key=True),
    )
    # Later migrations add quote revisions. Keep this legacy fixture minimal,
    # while still representing the pre-existing quote table those migrations
    # legitimately evolve on a real WorkHive database.
    Table(
        "quotes",
        metadata,
        Column("id", Integer, primary_key=True),
    )
    # `main` also carries the object-storage branch from this historical
    # revision. These are intentionally minimal because this test only
    # validates catalog backfill, but they must exist for that branch to run.
    Table("invoices", metadata, Column("id", Integer, primary_key=True))
    # The explicit-permission migration evolves these pre-existing tables too.
    Table(
        "company_memberships", metadata,
        Column("id", Integer, primary_key=True),
        Column("company_id", Integer, nullable=False),
    )
    Table(
        "membership_permission_profile_assignments", metadata,
        Column("id", Integer, primary_key=True),
        Column("company_id", Integer, nullable=False),
        Column("company_membership_id", Integer, nullable=False),
    )
    Table(
        "company_fiscal_settings",
        metadata,
        Column("id", Integer, primary_key=True),
    )
    alembic_version = Table(
        "alembic_version",
        metadata,
        Column("version_num", String(32), primary_key=True),
    )
    engine = create_engine(database_url)
    try:
        metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(
                template_tasks.insert().values(
                    id=7,
                    name="Limpieza heredada",
                    description="- [ ] Revisar llaves",
                    default_price=75.0,
                    unit="servicio",
                    pricing_mode="fixed",
                    is_active=1,
                    company_id=3,
                )
            )
            connection.execute(alembic_version.insert().values(version_num="i2j3k4l5m6n"))
            connection.execute(task_items.insert().values(id=9, template_task_id=7))

        command.upgrade(Config("alembic.ini"), "head")

        inspector = inspect(engine)
        assert {
            "catalog_version",
            "estimated_duration_minutes",
            "requirements",
        } <= {column["name"] for column in inspector.get_columns("template_tasks")}
        assert inspector.has_table("service_catalog_versions")
        assert "service_catalog_version_id" in {
            column["name"] for column in inspector.get_columns("task_items")
        }
        with engine.connect() as connection:
            version = connection.execute(
                text(
                    "SELECT template_task_id, version, name, default_price, unit "
                    "FROM service_catalog_versions"
                )
            ).one()
        assert tuple(version) == (7, 1, "Limpieza heredada", 75.0, "servicio")
        with engine.connect() as connection:
            linked_version_id = connection.execute(
                text("SELECT service_catalog_version_id FROM task_items WHERE id = 9")
            ).scalar_one()
        assert linked_version_id is not None
    finally:
        engine.dispose()
