from alembic import op
import sqlalchemy as sa
revision="c0d1e2f3g4h"
down_revision="b9c0d1e2f3g"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("company_hierarchy",sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id",ondelete="CASCADE"),primary_key=True),
        sa.Column("parent_company_id",sa.Integer,sa.ForeignKey("companies.id",ondelete="RESTRICT"),nullable=False,index=True),
        sa.CheckConstraint("company_id != parent_company_id",name="ck_company_hierarchy_parent"))


def downgrade():op.drop_table("company_hierarchy")
