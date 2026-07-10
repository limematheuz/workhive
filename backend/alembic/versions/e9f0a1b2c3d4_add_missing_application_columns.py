"""add missing application columns

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-06-22
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e9f0a1b2c3d4"
down_revision: str | None = "d8e9f0a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    location_columns = _column_names("locations")
    if "location_type" not in location_columns:
        op.add_column(
            "locations",
            sa.Column(
                "location_type",
                sa.String(length=50),
                nullable=True,
                server_default="private",
            ),
        )
        op.alter_column("locations", "location_type", server_default=None)

    task_columns = _column_names("task_items")
    if "priority" not in task_columns:
        op.add_column(
            "task_items",
            sa.Column(
                "priority",
                sa.String(length=20),
                nullable=False,
                server_default="medium",
            ),
        )
        op.alter_column("task_items", "priority", server_default=None)

    quote_columns = _column_names("quotes")
    required_quote_columns = {
        "discount": sa.Column(
            "discount",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        "equivalence_surcharge": sa.Column(
            "equivalence_surcharge",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        "retention": sa.Column(
            "retention",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        "terms": sa.Column("terms", sa.String(length=1000)),
        "shipping_address": sa.Column(
            "shipping_address",
            sa.String(length=500),
        ),
        "custom_issuer_info": sa.Column(
            "custom_issuer_info",
            sa.String(length=1000),
        ),
        "custom_recipient_info": sa.Column(
            "custom_recipient_info",
            sa.String(length=1000),
        ),
        "signature_url": sa.Column("signature_url", sa.Text()),
    }
    for column_name, column in required_quote_columns.items():
        if column_name not in quote_columns:
            op.add_column("quotes", column)
            if column_name in {"discount", "equivalence_surcharge", "retention"}:
                op.alter_column("quotes", column_name, server_default=None)


def downgrade() -> None:
    quote_columns = _column_names("quotes")
    for column_name in (
        "signature_url",
        "custom_recipient_info",
        "custom_issuer_info",
        "shipping_address",
        "terms",
        "retention",
        "equivalence_surcharge",
        "discount",
    ):
        if column_name in quote_columns:
            op.drop_column("quotes", column_name)

    if "priority" in _column_names("task_items"):
        op.drop_column("task_items", "priority")
    if "location_type" in _column_names("locations"):
        op.drop_column("locations", "location_type")
