from alembic import op
import sqlalchemy as sa
revision="d1e2f3g4h5i"
down_revision="c0d1e2f3g4h"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table("work_crews",sa.Column("id",sa.Integer,primary_key=True),sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("name",sa.String(120),nullable=False),sa.Column("description",sa.String(2000),nullable=False),sa.Column("leader_employee_id",sa.Integer,sa.ForeignKey("staff_employees.id")),sa.Column("is_active",sa.Boolean,nullable=False),sa.UniqueConstraint("company_id","name",name="uq_work_crew_company_name"))
    op.create_table("work_crew_members",sa.Column("crew_id",sa.Integer,sa.ForeignKey("work_crews.id",ondelete="CASCADE"),primary_key=True),sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id",ondelete="CASCADE"),primary_key=True))
    op.create_table("work_order_scopes",sa.Column("work_order_id",sa.Integer,sa.ForeignKey("work_orders.id",ondelete="CASCADE"),primary_key=True),sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),sa.Column("spaces",sa.JSON,nullable=False))
    op.create_table("task_space_staff",sa.Column("id",sa.Integer,primary_key=True),sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("task_id",sa.Integer,sa.ForeignKey("task_items.id",ondelete="CASCADE"),nullable=False,index=True),sa.Column("space_id",sa.Integer,sa.ForeignKey("location_zones.id"),nullable=False,index=True),
        sa.Column("space_name",sa.String(100),nullable=False),sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False,index=True),sa.Column("crew_id",sa.Integer,sa.ForeignKey("work_crews.id")),sa.Column("planned_minutes",sa.Integer),sa.UniqueConstraint("task_id","space_id","employee_id",name="uq_task_space_employee"))
    op.create_table("staff_checklist_progress",sa.Column("allocation_id",sa.Integer,sa.ForeignKey("task_space_staff.id",ondelete="CASCADE"),primary_key=True),sa.Column("checklist_id",sa.Integer,sa.ForeignKey("task_checklist_items.id",ondelete="CASCADE"),primary_key=True),sa.Column("completed",sa.Boolean,nullable=False),sa.Column("answer",sa.String(5)),sa.Column("completed_by",sa.Integer,sa.ForeignKey("users.id")),sa.Column("completed_at",sa.DateTime(timezone=True)))
    op.create_table("quote_work_scopes",sa.Column("quote_id",sa.Integer,sa.ForeignKey("quotes.id",ondelete="CASCADE"),primary_key=True),sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),sa.Column("location_id",sa.Integer,sa.ForeignKey("locations.id"),nullable=False),sa.Column("configuration",sa.JSON,nullable=False),sa.Column("opportunity_id",sa.Integer,sa.ForeignKey("client_opportunities.id",ondelete="SET NULL"),index=True))
    connection=op.get_bind()
    staff=sa.table("staff_employees",sa.column("id",sa.Integer),sa.column("company_id",sa.Integer),sa.column("team",sa.String))
    crew=sa.table("work_crews",sa.column("id",sa.Integer),sa.column("company_id",sa.Integer),sa.column("name",sa.String),sa.column("description",sa.String),sa.column("is_active",sa.Boolean))
    member=sa.table("work_crew_members",sa.column("crew_id",sa.Integer),sa.column("employee_id",sa.Integer))
    for company,name in connection.execute(sa.select(staff.c.company_id,staff.c.team).where(staff.c.team!="").distinct()):
        connection.execute(crew.insert().values(company_id=company,name=name,description="",is_active=True))
        crew_id=connection.execute(sa.select(crew.c.id).where(crew.c.company_id==company,crew.c.name==name)).scalar_one()
        ids=connection.execute(sa.select(staff.c.id).where(staff.c.company_id==company,staff.c.team==name)).scalars().all()
        if ids:connection.execute(member.insert(),[dict(crew_id=crew_id,employee_id=id) for id in ids])


def downgrade():
    for name in ("quote_work_scopes","staff_checklist_progress","task_space_staff","work_order_scopes","work_crew_members","work_crews"):op.drop_table(name)
