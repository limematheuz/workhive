import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.core.database_url import to_sync_database_url


def _migration_engine():
    return create_engine(
        to_sync_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"])
    )


def test_alembic_has_exactly_one_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert len(script.get_heads()) == 1


def test_container_start_applies_migrations_before_serving_requests():
    start_script = (os.path.dirname(__file__) + "/../start.sh")
    with open(start_script, encoding="utf-8") as script_file:
        script = script_file.read()

    assert script.index("alembic upgrade head") < script.index("exec uvicorn")


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_postgresql_schema_matches_invoice_model_contract():
    engine = _migration_engine()
    try:
        inspector = inspect(engine)
        company_columns = {
            column["name"] for column in inspector.get_columns("companies")
        }
        quote_columns = {
            column["name"]: column for column in inspector.get_columns("quotes")
        }
        invoice_columns = {column["name"] for column in inspector.get_columns("invoices")}
        sales_ledger_columns = {
            column["name"] for column in inspector.get_columns("sales_ledger_records")
        }
        invitation_columns = {
            column["name"] for column in inspector.get_columns("user_invitations")
        }
        task_columns = {column["name"] for column in inspector.get_columns("task_items")}
        template_task_columns = {
            column["name"] for column in inspector.get_columns("template_tasks")
        }
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
        task_report_columns = {
            column["name"] for column in inspector.get_columns("task_reports")
        }
        calendar_platform_columns = {
            column["name"]
            for column in inspector.get_columns("platform_calendar_config")
        }
        company_calendar_columns = {
            column["name"]
            for column in inspector.get_columns("company_calendar_settings")
        }
        ownership_request_columns = {
            column["name"]
            for column in inspector.get_columns("calendar_ownership_requests")
        }
        calendar_connection_unique_constraints = {
            tuple(constraint["column_names"])
            for constraint in inspector.get_unique_constraints(
                "google_calendar_connections"
            )
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
    assert "operating_model" in company_columns
    assert "swift_bic" in company_columns
    assert quote_columns["client_id"]["nullable"] is True
    assert "paid_at" in invoice_columns
    assert "payment_method" in invoice_columns
    assert {
        "company_id",
        "created_by_user_id",
        "document_number",
        "entry_date",
        "client_name",
        "base_amount",
        "tax_amount",
        "total_amount",
        "payment_status",
        "is_active",
    } <= sales_ledger_columns
    assert {"token_hash", "code_hash", "expires_at", "failed_attempts"} <= invitation_columns
    assert "reported_issues" in task_columns
    # The task read endpoint serializes these fields for every list view. Keep
    # this contract coupled to Alembic so an unapplied pricing migration cannot
    # surface as a production 500 while loading dashboards or calendars.
    assert {
        "pricing_mode",
        "worked_seconds_snapshot",
        "pricing_locked_at",
        "billing_pricing_mode_snapshot",
        "billing_price_snapshot",
        "billing_quantity_snapshot",
        "billing_unit_snapshot",
    } <= task_columns
    assert "pricing_mode" in template_task_columns
    assert {"user_id", "company_id", "event_type", "read_at", "href"} <= notification_columns
    assert {"task_id", "user_id", "status", "source"} <= assignment_columns
    assert {"task_id", "position", "text", "completed"} <= checklist_columns
    assert {"checklist_item_id", "user_id", "status"} <= checklist_assignment_columns
    assert {
        "task_item_id",
        "reporter_user_id",
        "reporter_company_id",
        "requesting_company_id",
        "client_event_id",
        "report_type",
        "media_key",
        "created_at",
    } <= task_report_columns
    assert {
        "id",
        "company_connections_enabled",
        "updated_by_user_id",
    } <= calendar_platform_columns
    assert {"company_id", "owner_user_id"} <= company_calendar_columns
    assert {
        "company_id",
        "requester_user_id",
        "reviewed_by_user_id",
        "status",
    } <= ownership_request_columns
    assert ("company_id",) in calendar_connection_unique_constraints


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_task_structure_migration_backfills_valid_assignments_only():
    config = Config("alembic.ini")
    engine = _migration_engine()
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
            first_item_completed = connection.execute(
                text(
                    """
                    SELECT completed
                    FROM task_checklist_items
                    WHERE id = :item_id
                    """
                ),
                {"item_id": first_item_id},
            ).scalar_one()
            migrated_task_status = connection.execute(
                text("SELECT status FROM task_items WHERE id = :task_id"),
                {"task_id": task_id},
            ).scalar_one()
            migrated_report = connection.execute(
                text(
                    """
                    SELECT report_type, description, checklist_item_id
                    FROM task_reports
                    WHERE task_item_id = :task_id
                    """
                ),
                {"task_id": task_id},
            ).mappings().one()

        assert checklist_count == 2
        assert task_users == [user_id]
        assert checklist_users == [user_id]
        assert migrated_evidence[f"item_{first_item_id}"] == {
            "answer": "no",
            "note": "legacy",
        }
        assert first_item_completed is True
        assert migrated_task_status == "completed"
        assert dict(migrated_report) == {
            "report_type": "checklist_note",
            "description": "legacy",
            "checklist_item_id": first_item_id,
        }
    finally:
        command.upgrade(config, "head")
        engine.dispose()


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_calendar_governance_migration_keeps_only_active_admin_connection():
    config = Config("alembic.ini")
    engine = _migration_engine()
    suffix = uuid4().hex[:10]
    try:
        command.downgrade(config, "i1d2e3f4g5h6")
        with engine.begin() as connection:
            company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name, tax_id, address, phone, email)
                    VALUES (:name, :tax_id, 'Calendar migration', '600000010', :email)
                    RETURNING id
                    """
                ),
                {
                    "name": f"Calendar migration {suffix}",
                    "tax_id": f"CAL-{suffix}",
                    "email": f"calendar-{suffix}@example.test",
                },
            ).scalar_one()
            admin_role_id = connection.execute(
                text("SELECT id FROM roles WHERE name = 'admin'")
            ).scalar_one()
            manager_role_id = connection.execute(
                text("SELECT id FROM roles WHERE name = 'manager'")
            ).scalar_one()
            admin_id = connection.execute(
                text(
                    """
                    INSERT INTO users (
                        email, hashed_password, full_name, role_id,
                        company_id, is_active
                    ) VALUES (
                        :email, 'unused', 'Calendar Admin', :role_id,
                        :company_id, true
                    ) RETURNING id
                    """
                ),
                {
                    "email": f"calendar-admin-{suffix}@example.test",
                    "role_id": admin_role_id,
                    "company_id": company_id,
                },
            ).scalar_one()
            manager_id = connection.execute(
                text(
                    """
                    INSERT INTO users (
                        email, hashed_password, full_name, role_id,
                        company_id, is_active
                    ) VALUES (
                        :email, 'unused', 'Calendar Manager', :role_id,
                        :company_id, true
                    ) RETURNING id
                    """
                ),
                {
                    "email": f"calendar-manager-{suffix}@example.test",
                    "role_id": manager_role_id,
                    "company_id": company_id,
                },
            ).scalar_one()
            for owner_id, label in (
                (admin_id, "admin"),
                (manager_id, "manager"),
            ):
                connection.execute(
                    text(
                        """
                        INSERT INTO google_calendar_connections (
                            company_id, connected_by_user_id, owner_user_id,
                            calendar_id, calendar_name, access_token_encrypted
                        ) VALUES (
                            :company_id, :owner_id, :owner_id,
                            :calendar_id, :calendar_name, 'encrypted-test-token'
                        )
                        """
                    ),
                    {
                        "company_id": company_id,
                        "owner_id": owner_id,
                        "calendar_id": f"calendar-{label}-{suffix}",
                        "calendar_name": f"Calendar {label}",
                    },
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO task_calendar_events (
                            company_id, user_id, external_event_id
                        ) VALUES (:company_id, :owner_id, :event_id)
                        """
                    ),
                    {
                        "company_id": company_id,
                        "owner_id": owner_id,
                        "event_id": f"event-{label}-{suffix}",
                    },
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO calendar_sync_jobs (
                            company_id, user_id, external_event_id, operation
                        ) VALUES (:company_id, :owner_id, :event_id, 'upsert')
                        """
                    ),
                    {
                        "company_id": company_id,
                        "owner_id": owner_id,
                        "event_id": f"event-{label}-{suffix}",
                    },
                )

        command.upgrade(config, "head")
        with engine.connect() as connection:
            connection_owners = connection.execute(
                text(
                    """
                    SELECT owner_user_id
                    FROM google_calendar_connections
                    WHERE company_id = :company_id
                    """
                ),
                {"company_id": company_id},
            ).scalars().all()
            configured_owner = connection.execute(
                text(
                    """
                    SELECT owner_user_id
                    FROM company_calendar_settings
                    WHERE company_id = :company_id
                    """
                ),
                {"company_id": company_id},
            ).scalar_one()
            event_owners = connection.execute(
                text(
                    """
                    SELECT user_id
                    FROM task_calendar_events
                    WHERE company_id = :company_id
                    """
                ),
                {"company_id": company_id},
            ).scalars().all()
            job_owners = connection.execute(
                text(
                    """
                    SELECT user_id
                    FROM calendar_sync_jobs
                    WHERE company_id = :company_id
                    """
                ),
                {"company_id": company_id},
            ).scalars().all()

        assert connection_owners == [admin_id]
        assert configured_owner == admin_id
        assert event_owners == [admin_id]
        assert job_owners == [admin_id]
    finally:
        command.upgrade(config, "head")
        engine.dispose()
