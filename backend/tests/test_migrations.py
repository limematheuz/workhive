import os

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text


def test_alembic_has_exactly_one_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert len(script.get_heads()) == 1


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_postgresql_schema_matches_invoice_model_contract():
    engine = create_engine(os.environ["MIGRATION_TEST_DATABASE_URL"])
    try:
        inspector = inspect(engine)
        invoice_columns = {column["name"] for column in inspector.get_columns("invoices")}
        invitation_columns = {
            column["name"] for column in inspector.get_columns("user_invitations")
        }
        with engine.connect() as connection:
            applied_revisions = {
                row[0]
                for row in connection.execute(text("SELECT version_num FROM alembic_version"))
            }
    finally:
        engine.dispose()

    script = ScriptDirectory.from_config(Config("alembic.ini"))
    assert applied_revisions == set(script.get_heads())
    assert "paid_at" in invoice_columns
    assert {"token_hash", "code_hash", "expires_at", "failed_attempts"} <= invitation_columns
