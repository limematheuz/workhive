"""freeze responsible team with closed labour-cost sessions

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
"""

import sqlalchemy as sa
from alembic import op


revision = "j1k2l3m4n5o6"
down_revision = "i0j1k2l3m4n5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_team_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_team_name_snapshot", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("labor_cost_team_snapshotted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_work_sessions_labor_cost_team_id",
        "work_sessions",
        ["labor_cost_team_id"],
    )
    # Historic rows have no reliable team-at-close record. Mark them as
    # deliberately unassigned so a future correction cannot infer a team from
    # mutable present-day location settings.
    op.execute(
        "UPDATE work_sessions "
        "SET labor_cost_team_snapshotted_at = end_time "
        "WHERE end_time IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_work_sessions_labor_cost_team_id", table_name="work_sessions")
    with op.batch_alter_table("work_sessions") as batch:
        batch.drop_column("labor_cost_team_snapshotted_at")
        batch.drop_column("labor_cost_team_name_snapshot")
        batch.drop_column("labor_cost_team_id")
