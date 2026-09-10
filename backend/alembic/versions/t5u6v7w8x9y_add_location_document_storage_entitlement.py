"""add plan-based location document storage quota

Revision ID: t5u6v7w8x9y
Revises: s4t5u6v7w8x
"""

from alembic import op
import sqlalchemy as sa


revision = "t5u6v7w8x9y"
down_revision = "s4t5u6v7w8x"
branch_labels = None
depends_on = None


LOCATION_DOCUMENT_STORAGE_BYTES = {
    "basic": 1 * 1024 * 1024,
    "medium": 1 * 1024 * 1024,
    "top": 10 * 1024 * 1024,
    "mega": 10 * 1024 * 1024,
    "custom": 10 * 1024 * 1024,
}


def upgrade() -> None:
    for plan_code, limit in LOCATION_DOCUMENT_STORAGE_BYTES.items():
        op.execute(
            sa.text(
                """
                INSERT INTO plan_entitlements (
                    plan_id, code, value_type, boolean_value, integer_value,
                    created_at, updated_at
                )
                SELECT subscription_plans.id, 'limits.location_document_storage_bytes',
                       'integer', NULL, :limit, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM subscription_plans
                WHERE subscription_plans.code = :plan_code
                  AND NOT EXISTS (
                    SELECT 1 FROM plan_entitlements
                    WHERE plan_entitlements.plan_id = subscription_plans.id
                      AND plan_entitlements.code = 'limits.location_document_storage_bytes'
                  )
                """
            ).bindparams(plan_code=plan_code, limit=limit)
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM plan_entitlements "
        "WHERE code = 'limits.location_document_storage_bytes'"
    )
