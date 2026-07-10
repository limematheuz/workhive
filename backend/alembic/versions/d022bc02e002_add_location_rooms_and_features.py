"""add location rooms and features

Revision ID: d022bc02e002
Revises: c011ab01e001
Create Date: 2026-06-05 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d022bc02e002"
down_revision: Union[str, None] = "c011ab01e001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("num_bathrooms", sa.Integer(), nullable=True, server_default="0"))
    op.add_column("locations", sa.Column("has_garage", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("locations", sa.Column("has_kitchen", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("locations", sa.Column("has_terrace", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("locations", sa.Column("rooms", sa.JSON(), nullable=True))
    op.add_column("locations", sa.Column("max_capacity", sa.Integer(), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("locations", "max_capacity")
    op.drop_column("locations", "rooms")
    op.drop_column("locations", "has_terrace")
    op.drop_column("locations", "has_kitchen")
    op.drop_column("locations", "has_garage")
    op.drop_column("locations", "num_bathrooms")
