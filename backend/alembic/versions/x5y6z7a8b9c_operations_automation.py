
from alembic import op
import sqlalchemy as sa

revision="x5y6z7a8b9c"
down_revision="w4x5y6z7a8b"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("operations_automations",
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),primary_key=True),
        sa.Column("recurring",sa.Boolean,nullable=False,server_default=sa.false()),
        sa.Column("documents",sa.Boolean,nullable=False,server_default=sa.false()),
        sa.Column("incidents",sa.Boolean,nullable=False,server_default=sa.false()),
        sa.Column("horizon_days",sa.Integer,nullable=False,server_default="7"),
        sa.Column("last_run",sa.DateTime(timezone=True)),
        sa.Column("last_result",sa.String(2000)))


def downgrade():
    op.drop_table("operations_automations")
