"""add photo_url to users

Revision ID: 7ac8b2d7f4a1
Revises: 19017f9a9e2c
Create Date: 2026-05-24 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7ac8b2d7f4a1"
down_revision: Union[str, None] = "19017f9a9e2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("photo_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_url")
