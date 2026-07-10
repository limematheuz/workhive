"""prefix_invoices_and_quotes

Revision ID: 8574254e39fa
Revises: a1b2c3d4e5f6
Create Date: 2026-05-30 13:49:07.033971

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8574254e39fa'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update invoices: prefix with 'INV-' if not already prefixed
    op.execute(
        "UPDATE invoices "
        "SET invoice_number = 'INV-' || invoice_number "
        "WHERE invoice_number NOT LIKE 'INV-%'"
    )
    # 2. Update quotes: replace 'PRES-' with 'QUO-', and prefix any non-prefixed with 'QUO-'
    op.execute(
        "UPDATE quotes "
        "SET quote_number = REPLACE(quote_number, 'PRES-', 'QUO-') "
        "WHERE quote_number LIKE 'PRES-%'"
    )
    op.execute(
        "UPDATE quotes "
        "SET quote_number = 'QUO-' || quote_number "
        "WHERE quote_number NOT LIKE 'QUO-%'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE invoices "
        "SET invoice_number = SUBSTRING(invoice_number FROM 5) "
        "WHERE invoice_number LIKE 'INV-%'"
    )
    op.execute(
        "UPDATE quotes "
        "SET quote_number = REPLACE(quote_number, 'QUO-', 'PRES-') "
        "WHERE quote_number LIKE 'QUO-%'"
    )

