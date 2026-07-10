"""add client type and optional tax id

Revision ID: g5d6e7f8a9b0
Revises: f4c5d6e7f8a9
Create Date: 2026-06-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g5d6e7f8a9b0"
down_revision: Union[str, None] = "f4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("clients") as batch_op:
        batch_op.drop_index("ix_clients_legal_number")
        batch_op.add_column(
            sa.Column(
                "client_type",
                sa.String(length=20),
                nullable=False,
                server_default="individual",
            )
        )
        batch_op.alter_column(
            "legal_number",
            existing_type=sa.String(length=20),
            nullable=True,
        )
        batch_op.create_index(
            "ix_clients_client_type",
            ["client_type"],
            unique=False,
        )
        batch_op.create_index(
            "ix_clients_legal_number",
            ["legal_number"],
            unique=False,
        )
        batch_op.create_unique_constraint(
            "uq_client_company_legal_number",
            ["company_id", "legal_number"],
        )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE clients SET legal_number = 'MISSING-' || id "
            "WHERE legal_number IS NULL"
        )
    )
    with op.batch_alter_table("clients") as batch_op:
        batch_op.drop_constraint(
            "uq_client_company_legal_number",
            type_="unique",
        )
        batch_op.drop_index("ix_clients_legal_number")
        batch_op.create_index(
            "ix_clients_legal_number",
            ["legal_number"],
            unique=True,
        )
        batch_op.drop_index("ix_clients_client_type")
        batch_op.alter_column(
            "legal_number",
            existing_type=sa.String(length=20),
            nullable=False,
        )
        batch_op.drop_column("client_type")
