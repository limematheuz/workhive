"""merge location workspace and published rollout heads

Revision ID: r2s3t4u5v6w
Revises: q0r1s2t3u4v, r1s2t3u4v5w
"""


revision = "r2s3t4u5v6w"
down_revision = ("q0r1s2t3u4v", "r1s2t3u4v5w")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Join independent migration branches without changing stored data."""


def downgrade() -> None:
    """Unmerge the branches; their schema migrations remain reversible."""
