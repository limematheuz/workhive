"""add PostgreSQL real-time invalidation signals

Revision ID: l3m4n5o6p7q
Revises: k2l3m4n5o6p
"""

from alembic import op


revision = "l3m4n5o6p7q"
down_revision = "k2l3m4n5o6p"
branch_labels = None
depends_on = None


TRIGGER_TABLES = (
    "task_items",
    "locations",
    "reservations",
    "notifications",
    "work_sessions",
    "clients",
    "company_collaborations",
    "data_subject_requests",
    "users",
)


def upgrade() -> None:
    # SQLite remains our lightweight migration-test database. PostgreSQL's
    # LISTEN/NOTIFY is intentionally a production capability, not a schema
    # requirement for a local SQLite fixture.
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute(
        """
        CREATE FUNCTION workhive_emit_realtime_invalidation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            subject jsonb;
            company_ids integer[] := ARRAY[]::integer[];
            user_ids integer[] := ARRAY[]::integer[];
            topics text[] := ARRAY[]::text[];
        BEGIN
            subject := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

            CASE TG_TABLE_NAME
                WHEN 'task_items' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    topics := ARRAY['tasks', 'dashboard', 'calendar', 'sidebar'];
                WHEN 'locations' THEN
                    company_ids := array_remove(ARRAY[
                        (subject ->> 'owner_company_id')::integer,
                        (subject ->> 'managing_company_id')::integer
                    ], NULL);
                    topics := ARRAY['locations', 'dashboard', 'calendar'];
                WHEN 'reservations' THEN
                    company_ids := array_remove(ARRAY[
                        (subject ->> 'owner_company_id')::integer,
                        (subject ->> 'assigned_company_id')::integer
                    ], NULL);
                    topics := ARRAY['reservations', 'tasks', 'calendar', 'notifications'];
                WHEN 'notifications' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    user_ids := array_remove(ARRAY[(subject ->> 'user_id')::integer], NULL);
                    topics := ARRAY['notifications', 'sidebar'];
                WHEN 'work_sessions' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'labor_cost_company_id')::integer], NULL);
                    user_ids := array_remove(ARRAY[(subject ->> 'user_id')::integer], NULL);
                    topics := ARRAY['live-work'];
                WHEN 'clients' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    topics := ARRAY['clients'];
                WHEN 'company_collaborations' THEN
                    company_ids := array_remove(ARRAY[
                        (subject ->> 'initiator_company_id')::integer,
                        (subject ->> 'partner_company_id')::integer
                    ], NULL);
                    topics := ARRAY['collaborations', 'locations', 'reservations'];
                WHEN 'data_subject_requests' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    user_ids := array_remove(ARRAY[(subject ->> 'requested_by_user_id')::integer], NULL);
                    topics := ARRAY['privacy', 'notifications'];
                WHEN 'users' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    user_ids := array_remove(ARRAY[(subject ->> 'id')::integer], NULL);
                    topics := ARRAY['calendar'];
            END CASE;

            IF cardinality(company_ids) = 0 AND cardinality(user_ids) = 0 THEN
                RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
            END IF;

            -- The payload intentionally contains only invalidation scopes, never
            -- tenant data. The API still authorizes every subsequent refetch.
            PERFORM pg_notify(
                'workhive_realtime',
                json_build_object(
                    'company_ids', company_ids,
                    'user_ids', user_ids,
                    'topics', topics
                )::text
            );

            RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END;
        $$;
        """
    )

    for table_name in TRIGGER_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER workhive_realtime_{table_name}
            AFTER INSERT OR UPDATE OR DELETE ON {table_name}
            FOR EACH ROW EXECUTE FUNCTION workhive_emit_realtime_invalidation();
            """
        )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for table_name in TRIGGER_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS workhive_realtime_{table_name} ON {table_name}")
    op.execute("DROP FUNCTION IF EXISTS workhive_emit_realtime_invalidation()")
