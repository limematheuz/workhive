import os
from uuid import uuid4

import pytest
from alembic import command
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
        task_columns = {column["name"] for column in inspector.get_columns("task_items")}
        notification_columns = {
            column["name"] for column in inspector.get_columns("notifications")
        }
        assignment_columns = {
            column["name"] for column in inspector.get_columns("task_assignments")
        }
        checklist_columns = {
            column["name"] for column in inspector.get_columns("task_checklist_items")
        }
        checklist_assignment_columns = {
            column["name"]
            for column in inspector.get_columns("task_checklist_assignments")
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
    assert "reported_issues" in task_columns
    assert {"user_id", "company_id", "event_type", "read_at", "href"} <= notification_columns
    assert {"task_id", "user_id", "status", "source"} <= assignment_columns
    assert {"task_id", "position", "text", "completed"} <= checklist_columns
    assert {"checklist_item_id", "user_id", "status"} <= checklist_assignment_columns


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_task_structure_migration_backfills_valid_assignments_only():
    config = Config("alembic.ini")
    engine = create_engine(os.environ["MIGRATION_TEST_DATABASE_URL"])
    suffix = uuid4().hex[:10]
    try:
        command.downgrade(config, "f8a9b0c1d2e3")
        with engine.begin() as connection:
            company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name, tax_id, address, phone, email)
                    VALUES (:name, :tax_id, 'Migration 1', '600000001', :email)
                    RETURNING id
                    """
                ),
                {
                    "name": f"Migration {suffix}",
                    "tax_id": f"MIG-{suffix}",
                    "email": f"migration-{suffix}@example.test",
                },
            ).scalar_one()
            foreign_company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name, tax_id, address, phone, email)
                    VALUES (:name, :tax_id, 'Migration 2', '600000002', :email)
                    RETURNING id
                    """
                ),
                {
                    "name": f"Foreign {suffix}",
                    "tax_id": f"FOR-{suffix}",
                    "email": f"foreign-{suffix}@example.test",
                },
            ).scalar_one()
            viewer_role_id = connection.execute(
                text("SELECT id FROM roles WHERE name = 'viewer'")
            ).scalar_one()
            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users (email, hashed_password, full_name, role_id, company_id, is_active)
                    VALUES (:email, 'unused', 'Valid Worker', :role_id, :company_id, true)
                    RETURNING id
                    """
                ),
                {
                    "email": f"valid-{suffix}@example.test",
                    "role_id": viewer_role_id,
                    "company_id": company_id,
                },
            ).scalar_one()
            foreign_user_id = connection.execute(
                text(
                    """
                    INSERT INTO users (email, hashed_password, full_name, role_id, company_id, is_active)
                    VALUES (:email, 'unused', 'Foreign Worker', :role_id, :company_id, true)
                    RETURNING id
                    """
                ),
                {
                    "email": f"foreign-worker-{suffix}@example.test",
                    "role_id": viewer_role_id,
                    "company_id": foreign_company_id,
                },
            ).scalar_one()
            location_id = connection.execute(
                text(
                    """
                    INSERT INTO locations (name, address, city, owner_company_id, managing_company_id)
                    VALUES ('Migration House', 'Migration 3', 'Madrid', :company_id, :company_id)
                    RETURNING id
                    """
                ),
                {"company_id": company_id},
            ).scalar_one()
            task_id = connection.execute(
                text(
                    """
                    INSERT INTO task_items (
                        title, description, operational_notes, attachments,
                        checklist_evidence, reported_issues, quantity, unit,
                        status, priority, service_context, is_invoiced,
                        company_id, location_id
                    ) VALUES (
                        'Migration task', :description, '[]'::json, '[]'::json,
                        '{"parsed_1":{"answer":"no","note":"legacy"}}'::json,
                        '[]'::json, 1, 'servicio',
                        'accepted', 'medium', 'standalone', false,
                        :company_id, :location_id
                    ) RETURNING id
                    """
                ),
                {
                    "description": (
                        f"<!-- workhive_assignees:{user_id} -->\n"
                        f"- [ ] Cocina (@{user_id}:Valid Worker:accepted)\n"
                        f"- [x] Intruso (@{foreign_user_id}:Foreign Worker:completed)"
                    ),
                    "company_id": company_id,
                    "location_id": location_id,
                },
            ).scalar_one()

        command.upgrade(config, "head")
        with engine.connect() as connection:
            checklist_count = connection.execute(
                text("SELECT count(*) FROM task_checklist_items WHERE task_id = :task_id"),
                {"task_id": task_id},
            ).scalar_one()
            task_users = connection.execute(
                text("SELECT user_id FROM task_assignments WHERE task_id = :task_id"),
                {"task_id": task_id},
            ).scalars().all()
            checklist_users = connection.execute(
                text(
                    """
                    SELECT assignment.user_id
                    FROM task_checklist_assignments AS assignment
                    JOIN task_checklist_items AS item
                      ON item.id = assignment.checklist_item_id
                    WHERE item.task_id = :task_id
                    """
                ),
                {"task_id": task_id},
            ).scalars().all()
            migrated_evidence = connection.execute(
                text(
                    """
                    SELECT checklist_evidence
                    FROM task_items
                    WHERE id = :task_id
                    """
                ),
                {"task_id": task_id},
            ).scalar_one()
            first_item_id = connection.execute(
                text(
                    """
                    SELECT id
                    FROM task_checklist_items
                    WHERE task_id = :task_id
                    ORDER BY position
                    LIMIT 1
                    """
                ),
                {"task_id": task_id},
            ).scalar_one()

        assert checklist_count == 2
        assert task_users == [user_id]
        assert checklist_users == [user_id]
        assert migrated_evidence[f"item_{first_item_id}"] == {
            "answer": "no",
            "note": "legacy",
        }
    finally:
        command.upgrade(config, "head")
        engine.dispose()
