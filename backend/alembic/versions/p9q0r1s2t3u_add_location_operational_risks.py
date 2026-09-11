"""add operational risks per location

Revision ID: p9q0r1s2t3u
Revises: n7o8p9q0r1s
"""

from alembic import op
import sqlalchemy as sa


revision = "p9q0r1s2t3u"
down_revision = "n7o8p9q0r1s"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "location_risks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("mitigation_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="ck_location_risk_severity",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'mitigated')",
            name="ck_location_risk_status",
        ),
    )
    op.create_index("ix_location_risks_location_id", "location_risks", ["location_id"])
    op.create_index("ix_location_risks_severity", "location_risks", ["severity"])
    op.create_index("ix_location_risks_status", "location_risks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_location_risks_status", table_name="location_risks")
    op.drop_index("ix_location_risks_severity", table_name="location_risks")
    op.drop_index("ix_location_risks_location_id", table_name="location_risks")
    op.drop_table("location_risks")
