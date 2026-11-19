from alembic import op
import sqlalchemy as sa
revision="j7k8l9m0n1o"
down_revision="i6j7k8l9m0n"
branch_labels=None
depends_on=None


def upgrade():
    with op.batch_alter_table("departments") as batch:
        batch.add_column(sa.Column("unit_type",sa.String(20),nullable=False,server_default="area"))
        batch.create_check_constraint("ck_department_unit_type","unit_type IN ('area','branch')")


def downgrade():
    with op.batch_alter_table("departments") as batch:
        batch.drop_constraint("ck_department_unit_type",type_="check")
        batch.drop_column("unit_type")
