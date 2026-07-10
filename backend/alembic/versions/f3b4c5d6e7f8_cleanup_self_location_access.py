"""cleanup self location access

Revision ID: f3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-06-06 17:10:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM location_company_access AS access
        USING locations, clients
        WHERE access.location_id = locations.id
          AND locations.client_id = clients.id
          AND access.company_id = COALESCE(
              locations.managing_company_id,
              clients.company_id
          )
        """
    )


def downgrade() -> None:
    # Redundant self-access rows cannot be reconstructed reliably.
    pass
