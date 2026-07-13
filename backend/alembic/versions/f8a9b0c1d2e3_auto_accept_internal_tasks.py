"""auto accept internal tasks

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
"""

from collections.abc import Sequence

from alembic import op


revision: str = "f8a9b0c1d2e3"
down_revision: str | None = "e7f8a9b0c1d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Cross-company work waits in `requested`; `pending` is only the legacy
    # redundant approval state for work created inside the same company.
    op.execute("UPDATE task_items SET status = 'accepted' WHERE status = 'pending'")


def downgrade() -> None:
    # Accepted rows cannot safely be distinguished from rows accepted by a
    # manager, so reverting application code must not rewrite business state.
    pass
