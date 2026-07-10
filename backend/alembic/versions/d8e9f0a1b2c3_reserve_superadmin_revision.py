"""reserve the platform superadmin revision

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2

The first platform administrator is created interactively after deployment.
Credentials must never be embedded in migrations or source control.
"""


revision = "d8e9f0a1b2c3"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
