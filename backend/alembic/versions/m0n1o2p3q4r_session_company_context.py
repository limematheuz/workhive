"""Record the operational company independently from identity and cost snapshots."""
from alembic import op
import sqlalchemy as sa
revision="m0n1o2p3q4r"
down_revision="l9m0n1o2p3q"
branch_labels=None
depends_on=None


def upgrade():
    with op.batch_alter_table("work_sessions") as batch:
        batch.add_column(sa.Column("company_id",sa.Integer(),nullable=True))
        batch.create_foreign_key("fk_work_session_company_context","companies",["company_id"],["id"],ondelete="SET NULL")
        batch.create_index("ix_work_sessions_company_id",["company_id"])
    op.execute(sa.text("UPDATE work_sessions SET company_id=COALESCE((SELECT company_id FROM task_items WHERE task_items.id=work_sessions.task_item_id),labor_cost_company_id,(SELECT company_id FROM users WHERE users.id=work_sessions.user_id))"))


def downgrade():
    with op.batch_alter_table("work_sessions") as batch:
        batch.drop_index("ix_work_sessions_company_id")
        batch.drop_constraint("fk_work_session_company_context",type_="foreignkey")
        batch.drop_column("company_id")
