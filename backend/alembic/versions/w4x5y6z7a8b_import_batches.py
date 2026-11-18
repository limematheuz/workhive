
from alembic import op
import sqlalchemy as sa

revision="w4x5y6z7a8b"
down_revision="v3w4x5y6z7a"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("import_batches",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False),
        sa.Column("digest",sa.String(64),nullable=False),
        sa.Column("kind",sa.String(20),nullable=False),
        sa.Column("result_ids",sa.JSON,nullable=False),
        sa.Column("created_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.UniqueConstraint("company_id","digest",name="uq_import_company_digest"))


def downgrade():
    op.drop_table("import_batches")
