from alembic import op
import sqlalchemy as sa
revision="b9c0d1e2f3g"
down_revision="a8b9c0d1e2f"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("advisory_requests",sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("requested_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False,index=True),
        sa.Column("area",sa.String(20),nullable=False),sa.Column("description",sa.String(2000),nullable=False),
        sa.Column("response",sa.Text),sa.Column("answered_by",sa.Integer,sa.ForeignKey("users.id")),
        sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("answered_at",sa.DateTime(timezone=True)))


def downgrade():op.drop_table("advisory_requests")
