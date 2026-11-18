from alembic import op
import sqlalchemy as sa
revision="l9m0n1o2p3q"
down_revision="k8l9m0n1o2p"
branch_labels=None
depends_on=None

def upgrade():
    op.add_column("locations",sa.Column("is_temporary",sa.Boolean(),nullable=False,server_default=sa.false()))
    op.create_index("ix_locations_is_temporary","locations",["is_temporary"])
    with op.batch_alter_table("task_space_staff") as batch:batch.alter_column("space_id",existing_type=sa.Integer(),nullable=True)

def downgrade():
    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM task_space_staff WHERE space_id IS NULL")).scalar():
        raise RuntimeError("Archive or migrate general job assignments before downgrading.")
    with op.batch_alter_table("task_space_staff") as batch:batch.alter_column("space_id",existing_type=sa.Integer(),nullable=False)
    op.drop_index("ix_locations_is_temporary",table_name="locations")
    with op.batch_alter_table("locations") as batch:batch.drop_column("is_temporary")
