"""narrow real-time invalidation topics by domain

Revision ID: m4n5o6p7q8r
Revises: l3m4n5o6p7q
"""

from alembic import op


revision = "m4n5o6p7q8r"
down_revision = "l3m4n5o6p7q"
branch_labels = None
depends_on = None


def _replace_invalidation_function(
    *,
    task_topics: str,
    location_topics: str,
    notification_topics: str,
) -> None:
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION workhive_emit_realtime_invalidation()
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
                    topics := ARRAY[{task_topics}];
                WHEN 'locations' THEN
                    company_ids := array_remove(ARRAY[
                        (subject ->> 'owner_company_id')::integer,
                        (subject ->> 'managing_company_id')::integer
                    ], NULL);
                    topics := ARRAY[{location_topics}];
                WHEN 'reservations' THEN
                    company_ids := array_remove(ARRAY[
                        (subject ->> 'owner_company_id')::integer,
                        (subject ->> 'assigned_company_id')::integer
                    ], NULL);
                    topics := ARRAY['reservations', 'tasks', 'calendar', 'notifications'];
                WHEN 'notifications' THEN
                    company_ids := array_remove(ARRAY[(subject ->> 'company_id')::integer], NULL);
                    user_ids := array_remove(ARRAY[(subject ->> 'user_id')::integer], NULL);
                    topics := ARRAY[{notification_topics}];
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


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    _replace_invalidation_function(
        task_topics="'tasks', 'calendar', 'sidebar'",
        location_topics="'locations', 'calendar'",
        notification_topics="'notifications'",
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    _replace_invalidation_function(
        task_topics="'tasks', 'dashboard', 'calendar', 'sidebar'",
        location_topics="'locations', 'dashboard', 'calendar'",
        notification_topics="'notifications', 'sidebar'",
    )
