"""repair company location links

Revision ID: r6i7j8k9l0m1
Revises: q5h6i7j8k9l0
"""

from alembic import op


revision = "r6i7j8k9l0m1"
down_revision = "q5h6i7j8k9l0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE locations AS location
        SET default_service_provider_id = NULL
        WHERE default_service_provider_id IS NOT NULL
          AND (
            default_service_provider_id = owner_company_id
            OR NOT EXISTS (
                SELECT 1
                FROM companies AS provider
                WHERE provider.id = location.default_service_provider_id
                  AND provider.is_active IS TRUE
            )
            OR NOT EXISTS (
                SELECT 1
                FROM company_collaborations AS collaboration
                WHERE collaboration.status = 'accepted'
                  AND (
                    (
                      collaboration.initiator_company_id = location.owner_company_id
                      AND collaboration.partner_company_id = location.default_service_provider_id
                    )
                    OR (
                      collaboration.partner_company_id = location.owner_company_id
                      AND collaboration.initiator_company_id = location.default_service_provider_id
                    )
                  )
            )
          )
        """
    )
    op.execute(
        """
        INSERT INTO location_company_access (
          location_id,
          company_id,
          relationship_type,
          can_manage_reservations,
          can_manage_tasks,
          can_view_sensitive
        )
        SELECT
          id,
          default_service_provider_id,
          'default_service_provider',
          FALSE,
          TRUE,
          FALSE
        FROM locations
        WHERE default_service_provider_id IS NOT NULL
        ON CONFLICT (location_id, company_id)
        DO UPDATE SET
          relationship_type = 'default_service_provider',
          can_manage_tasks = TRUE,
          updated_at = now()
        """
    )
    op.execute(
        """
        UPDATE location_company_access AS access
        SET relationship_type = 'service_provider',
            updated_at = now()
        FROM locations AS location
        WHERE access.location_id = location.id
          AND access.relationship_type = 'default_service_provider'
          AND access.company_id IS DISTINCT FROM location.default_service_provider_id
        """
    )


def downgrade() -> None:
    pass
