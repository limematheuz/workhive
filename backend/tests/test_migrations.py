import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.core.database_url import to_sync_database_url
from app.db.base import Base


def _migration_engine():
    return create_engine(
        to_sync_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"])
    )


def test_alembic_has_exactly_one_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert len(script.get_heads()) == 1


@pytest.mark.parametrize("entrypoint", ("start.sh", "dev.sh"))
def test_backend_entrypoints_apply_migrations_before_serving_requests(entrypoint):
    script_path = os.path.dirname(__file__) + f"/../{entrypoint}"
    with open(script_path, encoding="utf-8") as script_file:
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
        quote_revision_columns = {
            column["name"] for column in inspector.get_columns("quote_revisions")
        }
        service_contract_columns = {
            column["name"] for column in inspector.get_columns("service_contracts")
        }
        service_contract_line_columns = {
            column["name"]
            for column in inspector.get_columns("service_contract_lines")
        }
        service_contract_location_columns = {
            column["name"]
            for column in inspector.get_columns("service_contract_locations")
        }
        service_contract_location_zone_columns = {
            column["name"]
            for column in inspector.get_columns("service_contract_location_zones")
        }
        invoice_columns = {
            column["name"] for column in inspector.get_columns("invoices")
        }
        expense_columns = {
            column["name"] for column in inspector.get_columns("expenses")
        }
        sales_ledger_columns = {
            column["name"] for column in inspector.get_columns("sales_ledger_records")
        }
        invitation_columns = {
            column["name"] for column in inspector.get_columns("user_invitations")
        }
        task_columns = {
            column["name"] for column in inspector.get_columns("task_items")
        }
        template_task_columns = {
            column["name"] for column in inspector.get_columns("template_tasks")
        }
        service_catalog_version_columns = {
            column["name"]
            for column in inspector.get_columns("service_catalog_versions")
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
        company_membership_columns = {
            column["name"] for column in inspector.get_columns("company_memberships")
        }
        department_columns = {
            column["name"] for column in inspector.get_columns("departments")
        }
        team_columns = {column["name"] for column in inspector.get_columns("teams")}
        permission_profile_columns = {
            column["name"] for column in inspector.get_columns("permission_profiles")
        }
        permission_scope_columns = {
            column["name"]
            for column in inspector.get_columns("membership_permission_profile_scopes")
        }
        external_access_grant_columns = {
            column["name"]
            for column in inspector.get_columns("external_access_grants")
        }
        client_portal_grant_columns = {
            column["name"]
            for column in inspector.get_columns("client_portal_grants")
        }
        client_portal_invitation_columns = {
            column["name"]
            for column in inspector.get_columns("client_portal_invitations")
        }
        client_portal_invitation_foreign_keys = {
            tuple(foreign_key["constrained_columns"])
            for foreign_key in inspector.get_foreign_keys("client_portal_invitations")
        }
        api_access_key_columns = {
            column["name"] for column in inspector.get_columns("api_access_keys")
        }
        client_columns = {
            column["name"] for column in inspector.get_columns("clients")
        }
        client_contact_columns = {
            column["name"] for column in inspector.get_columns("client_contacts")
        }
        client_contact_role_columns = {
            column["name"]
            for column in inspector.get_columns("client_contact_roles")
        }
        location_contact_columns = {
            column["name"] for column in inspector.get_columns("location_contacts")
        }
        location_risk_columns = {
            column["name"] for column in inspector.get_columns("location_risks")
        }
        location_service_window_columns = {
            column["name"]
            for column in inspector.get_columns("location_service_windows")
        }
        client_opportunity_columns = {
            column["name"]
            for column in inspector.get_columns("client_opportunities")
        }
        client_opportunity_activity_columns = {
            column["name"]
            for column in inspector.get_columns("client_opportunity_activities")
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
                for row in connection.execute(
                    text("SELECT version_num FROM alembic_version")
                )
            }
    finally:
        engine.dispose()

    script = ScriptDirectory.from_config(Config("alembic.ini"))
    assert applied_revisions == set(script.get_heads())
    assert "operating_model" in company_columns
    assert "swift_bic" in company_columns
    assert quote_columns["client_id"]["nullable"] is True
    assert {"revision_number", "accepted_revision_id"} <= set(quote_columns)
    assert {
        "quote_id",
        "company_id",
        "version",
        "snapshot",
        "created_at",
        "accepted_at",
    } <= quote_revision_columns
    assert {
        "company_id",
        "client_id",
        "source_quote_id",
        "source_quote_revision_id",
        "contract_number",
        "status",
        "renewal_mode",
        "quote_snapshot",
    } <= service_contract_columns
    assert {"contract_id", "position", "description", "quantity", "unit_price", "subtotal"} <= service_contract_line_columns
    assert {"contract_id", "location_id", "is_active", "covered_from", "covered_until"} <= service_contract_location_columns
    assert {"contract_location_id", "zone_id"} <= service_contract_location_zone_columns
    assert "paid_at" in invoice_columns
    assert "payment_method" in invoice_columns
    assert "client_id" in expense_columns
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
    assert {
        "token_hash",
        "code_hash",
        "expires_at",
        "failed_attempts",
        "rejoin_user_id",
    } <= invitation_columns
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
    assert {
        "pricing_mode",
        "catalog_version",
        "estimated_duration_minutes",
        "requirements",
    } <= template_task_columns
    assert {
        "template_task_id",
        "version",
        "name",
        "description",
        "default_price",
        "unit",
        "pricing_mode",
        "estimated_duration_minutes",
        "requirements",
    } <= service_catalog_version_columns
    assert {
        "user_id",
        "company_id",
        "event_type",
        "read_at",
        "href",
        "dedupe_key",
    } <= notification_columns
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
    assert {
        "user_id",
        "company_id",
        "access_class",
        "status",
        "started_at",
        "ended_at",
    } <= company_membership_columns
    assert {
        "company_id",
        "parent_department_id",
        "name",
        "normalized_name",
        "code",
        "is_active",
    } <= department_columns
    assert {"company_id", "department_id", "name", "code", "is_active"} <= team_columns
    assert {
        "company_id",
        "name",
        "is_system",
        "is_active",
    } <= permission_profile_columns
    assert {
        "company_id",
        "profile_assignment_id",
        "scope_type",
        "scope_id",
    } <= permission_scope_columns
    assert {
        "company_id",
        "user_id",
        "access_type",
        "status",
        "expires_at",
        "granted_by_user_id",
        "revoked_by_user_id",
        "revoked_at",
    } <= external_access_grant_columns
    assert {
        "company_id",
        "client_id",
        "user_id",
        "status",
        "expires_at",
        "granted_by_user_id",
        "revoked_by_user_id",
        "revoked_at",
    } <= client_portal_grant_columns
    assert {
        "company_id",
        "client_id",
        "email",
        "token_hash",
        "verification_code_hash",
        "status",
        "expires_at",
        "accepted_at",
    } <= client_portal_invitation_columns
    assert ("client_id", "company_id") in client_portal_invitation_foreign_keys
    assert {
        "company_id",
        "name",
        "key_prefix",
        "key_hash",
        "scopes",
        "status",
        "expires_at",
        "last_used_at",
        "revoked_at",
    } <= api_access_key_columns
    assert "relationship_status" in client_columns
    assert {
        "id",
        "client_id",
        "full_name",
        "email",
        "phone",
        "job_title",
        "is_primary",
        "is_active",
    } <= client_contact_columns
    assert {"id", "client_contact_id", "role"} <= client_contact_role_columns
    assert {
        "location_id",
        "full_name",
        "email",
        "phone",
        "role",
        "is_primary",
        "is_active",
    } <= location_contact_columns
    assert {
        "location_id",
        "title",
        "description",
        "severity",
        "status",
        "mitigation_notes",
    } <= location_risk_columns
    assert {
        "location_id",
        "label",
        "days",
        "starts_at",
        "ends_at",
        "notes",
        "is_active",
    } <= location_service_window_columns
    assert {
        "id",
        "client_id",
        "contact_id",
        "owner_membership_id",
        "title",
        "stage",
        "next_follow_up_at",
        "loss_reason",
    } <= client_opportunity_columns
    assert {
        "id",
        "opportunity_id",
        "activity_type",
        "body",
        "stage_from",
        "stage_to",
        "happened_at",
    } <= client_opportunity_activity_columns
    assert ("company_id",) in calendar_connection_unique_constraints


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_client_contact_migration_preserves_legacy_contact_details():
    config = Config("alembic.ini")
    engine = _migration_engine()
    suffix = uuid4().hex[:10]
    try:
        command.downgrade(config, "q6r7s8t9u0v1")
        with engine.begin() as connection:
            company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name, tax_id, address, phone, email)
                    VALUES (:name, :tax_id, 'Migration address', '600000022', :email)
                    RETURNING id
                    """
                ),
                {
                    "name": f"Client contact migration {suffix}",
                    "tax_id": f"CONTACT-{suffix}",
                    "email": f"contact-{suffix}@example.test",
                },
            ).scalar_one()
            client_id = connection.execute(
                text(
                    """
                    INSERT INTO clients (
                        name, client_type, address, city, postal_code, country,
                        email, phone, is_active, company_id
                    ) VALUES (
                        :name, 'company', 'Migration street 1', 'Madrid', '28001',
                        'España', :email, :phone, true, :company_id
                    ) RETURNING id
                    """
                ),
                {
                    "name": f"Legacy contact {suffix}",
                    "email": f"legacy-{suffix}@example.test",
                    "phone": "600000023",
                    "company_id": company_id,
                },
            ).scalar_one()

        command.upgrade(config, "head")
        with engine.connect() as connection:
            contact = connection.execute(
                text(
                    """
                    SELECT full_name, email, phone, is_primary, is_active
                    FROM client_contacts
                    WHERE client_id = :client_id
                    """
                ),
                {"client_id": client_id},
            ).mappings().one()
            relationship_status = connection.execute(
                text("SELECT relationship_status FROM clients WHERE id = :client_id"),
                {"client_id": client_id},
            ).scalar_one()
    finally:
        engine.dispose()

    assert contact == {
        "full_name": f"Legacy contact {suffix}",
        "email": f"legacy-{suffix}@example.test",
        "phone": "600000023",
        "is_primary": True,
        "is_active": True,
    }
    assert relationship_status == "client"


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_enterprise_access_migration_backfills_legacy_company_users():
    config = Config("alembic.ini")
    engine = _migration_engine()
    suffix = uuid4().hex[:10]
    try:
        command.downgrade(config, "h8i9j0k1l2m3")
        with engine.begin() as connection:
            company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name, tax_id, address, phone, email)
                    VALUES (:name, :tax_id, 'Migration address', '600000011', :email)
                    RETURNING id
                    """
                ),
                {
                    "name": f"Enterprise access {suffix}",
                    "tax_id": f"ACCESS-{suffix}",
                    "email": f"access-{suffix}@example.test",
                },
            ).scalar_one()
            role_ids = {
                role_name: connection.execute(
                    text("SELECT id FROM roles WHERE name = :role_name"),
                    {"role_name": role_name},
                ).scalar_one()
                for role_name in (
                    "admin",
                    "manager",
                    "viewer",
                    "accountant",
                    "superadmin",
                )
            }
            for role_name in ("admin", "manager", "viewer", "accountant"):
                connection.execute(
                    text(
                        """
                        INSERT INTO users (
                            email, hashed_password, full_name, role_id,
                            company_id, is_active
                        ) VALUES (
                            :email, 'unused', :full_name, :role_id,
                            :company_id, :is_active
                        )
                        """
                    ),
                    {
                        "email": f"enterprise-{role_name}-{suffix}@example.test",
                        "full_name": role_name,
                        "role_id": role_ids[role_name],
                        "company_id": company_id,
                        "is_active": role_name != "viewer",
                    },
                )
            connection.execute(
                text(
                    """
                    INSERT INTO users (
                        email, hashed_password, full_name, role_id, is_active
                    ) VALUES (:email, 'unused', 'Platform', :role_id, true)
                    """
                ),
                {
                    "email": f"enterprise-platform-{suffix}@example.test",
                    "role_id": role_ids["superadmin"],
                },
            )

        command.upgrade(config, "head")
        with engine.connect() as connection:
            memberships = (
                connection.execute(
                    text(
                        """
                    SELECT users.email, memberships.access_class, memberships.status
                    FROM company_memberships AS memberships
                    JOIN users ON users.id = memberships.user_id
                    WHERE users.email LIKE :email_pattern
                    ORDER BY users.email
                    """
                    ),
                    {"email_pattern": f"enterprise-%-{suffix}@example.test"},
                )
                .mappings()
                .all()
            )
            permission_codes = (
                connection.execute(
                    text("SELECT code FROM permission_definitions ORDER BY code")
                )
                .scalars()
                .all()
            )
            administrator_profile = (
                connection.execute(
                    text(
                        """
                    SELECT profiles.is_system, count(profile_permissions.permission_definition_id)
                    FROM permission_profiles AS profiles
                    LEFT JOIN permission_profile_permissions AS profile_permissions
                      ON profile_permissions.permission_profile_id = profiles.id
                    WHERE profiles.company_id = :company_id
                      AND profiles.name = 'Administrador de empresa'
                    GROUP BY profiles.id, profiles.is_system
                    """
                    ),
                    {"company_id": company_id},
                )
                .mappings()
                .one()
            )
            administrator_scope = (
                connection.execute(
                    text(
                        """
                    SELECT scopes.scope_type, scopes.scope_id
                    FROM membership_permission_profile_assignments AS assignments
                    JOIN company_memberships AS memberships
                      ON memberships.id = assignments.company_membership_id
                    JOIN membership_permission_profile_scopes AS scopes
                      ON scopes.profile_assignment_id = assignments.id
                    JOIN users ON users.id = memberships.user_id
                    WHERE users.email = :email
                      AND assignments.is_active = true
                    """
                    ),
                    {"email": f"enterprise-admin-{suffix}@example.test"},
                )
                .mappings()
                .all()
            )
            external_grants = (
                connection.execute(
                    text(
                        """
                        SELECT users.email, grants.access_type, grants.status
                        FROM external_access_grants AS grants
                        JOIN users ON users.id = grants.user_id
                        WHERE users.email LIKE :email_pattern
                        ORDER BY users.email
                        """
                    ),
                    {"email_pattern": f"enterprise-%-{suffix}@example.test"},
                )
                .mappings()
                .all()
            )
            accountant_role_count = connection.execute(
                text("SELECT count(*) FROM roles WHERE name = 'accountant'")
            ).scalar_one()

        assert [dict(membership) for membership in memberships] == [
            {
                "email": f"enterprise-accountant-{suffix}@example.test",
                "access_class": "responsible",
                "status": "archived",
            },
            {
                "email": f"enterprise-admin-{suffix}@example.test",
                "access_class": "admin",
                "status": "active",
            },
            {
                "email": f"enterprise-manager-{suffix}@example.test",
                "access_class": "responsible",
                "status": "active",
            },
            {
                "email": f"enterprise-viewer-{suffix}@example.test",
                "access_class": "worker",
                "status": "suspended",
            },
        ]
        assert {
            "access.members.manage",
            "access.profiles.manage",
            "organization.departments.manage",
            "organization.teams.manage",
        } <= set(permission_codes)
        assert dict(administrator_profile) == {
            "is_system": True,
            "count": len(permission_codes),
        }
        assert [dict(scope) for scope in administrator_scope] == [
            {"scope_type": "company", "scope_id": company_id}
        ]
        assert [dict(grant) for grant in external_grants] == [
            {
                "email": f"enterprise-accountant-{suffix}@example.test",
                "access_type": "accountant",
                "status": "active",
            }
        ]
        assert accountant_role_count == 0
    finally:
        command.upgrade(config, "head")
        engine.dispose()


@pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL migration contract runs in CI",
)
def test_postgresql_schema_includes_every_declared_model_column():
    """Keep mapped fields and Alembic migrations aligned before deployment.

    The CI workflow first upgrades a clean PostgreSQL service to ``head``. This
    catches the class of regression where an ORM field is merged but its
    matching database migration is missing or not applied by the release.
    """
    engine = _migration_engine()
    try:
        inspector = inspect(engine)
        missing_columns = {
            table.name: sorted(
                {column.name for column in table.columns}
                - {column["name"] for column in inspector.get_columns(table.name)}
            )
            for table in Base.metadata.sorted_tables
            if inspector.has_table(table.name)
        }
        missing_tables = [
            table.name
            for table in Base.metadata.sorted_tables
            if not inspector.has_table(table.name)
        ]
    finally:
        engine.dispose()

    assert missing_tables == []
    assert {
        table_name: columns
        for table_name, columns in missing_columns.items()
        if columns
    } == {}


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
                text(
                    "SELECT count(*) FROM task_checklist_items WHERE task_id = :task_id"
                ),
                {"task_id": task_id},
            ).scalar_one()
            task_users = (
                connection.execute(
                    text(
                        "SELECT user_id FROM task_assignments WHERE task_id = :task_id"
                    ),
                    {"task_id": task_id},
                )
                .scalars()
                .all()
            )
            checklist_users = (
                connection.execute(
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
                )
                .scalars()
                .all()
            )
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
            migrated_report = (
                connection.execute(
                    text(
                        """
                    SELECT report_type, description, checklist_item_id
                    FROM task_reports
                    WHERE task_item_id = :task_id
                    """
                    ),
                    {"task_id": task_id},
                )
                .mappings()
                .one()
            )

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
            connection_owners = (
                connection.execute(
                    text(
                        """
                    SELECT owner_user_id
                    FROM google_calendar_connections
                    WHERE company_id = :company_id
                    """
                    ),
                    {"company_id": company_id},
                )
                .scalars()
                .all()
            )
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
            event_owners = (
                connection.execute(
                    text(
                        """
                    SELECT user_id
                    FROM task_calendar_events
                    WHERE company_id = :company_id
                    """
                    ),
                    {"company_id": company_id},
                )
                .scalars()
                .all()
            )
            job_owners = (
                connection.execute(
                    text(
                        """
                    SELECT user_id
                    FROM calendar_sync_jobs
                    WHERE company_id = :company_id
                    """
                    ),
                    {"company_id": company_id},
                )
                .scalars()
                .all()
            )

        assert connection_owners == [admin_id]
        assert configured_owner == admin_id
        assert event_owners == [admin_id]
        assert job_owners == [admin_id]
    finally:
        command.upgrade(config, "head")
        engine.dispose()
