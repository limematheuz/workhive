"""merge object storage and commercial rollout heads

Revision ID: r1s2t3u4v5w
Revises: j4k5l6m7n8o, m6n7o8p9q0r
"""


revision = "r1s2t3u4v5w"
down_revision = ("j4k5l6m7n8o", "m6n7o8p9q0r")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Join independent migration branches without changing stored data."""


def downgrade() -> None:
    """Unmerge the branches; their schema migrations remain reversible."""
