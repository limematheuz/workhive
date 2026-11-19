
from alembic import op
import sqlalchemy as sa

revision="y6z7a8b9c0d"
down_revision="x5y6z7a8b9c"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("staff_document_files",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False,index=True),
        sa.Column("name",sa.String(255),nullable=False),
        sa.Column("storage_key",sa.String(500),nullable=False,unique=True),
        sa.Column("content_type",sa.String(120),nullable=False),
        sa.Column("size_bytes",sa.Integer,nullable=False),
        sa.Column("sha256",sa.String(64),nullable=False),
        sa.Column("created_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))


def downgrade():
    op.drop_table("staff_document_files")
