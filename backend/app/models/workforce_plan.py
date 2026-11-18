from sqlalchemy import Column,Integer,ForeignKey,String,Text,Boolean,JSON,DateTime,UniqueConstraint,func
from app.db.session import Base


class WorkCrew(Base):
    __tablename__="work_crews"
    __table_args__=(UniqueConstraint("company_id","name",name="uq_work_crew_company_name"),)
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    name=Column(String(120),nullable=False)
    description=Column(String(2000),nullable=False,default="")
    leader_employee_id=Column(Integer,ForeignKey("staff_employees.id"),nullable=True)
    is_active=Column(Boolean,nullable=False,default=True)


class WorkCrewMember(Base):
    __tablename__="work_crew_members"
    crew_id=Column(Integer,ForeignKey("work_crews.id",ondelete="CASCADE"),primary_key=True)
    employee_id=Column(Integer,ForeignKey("staff_employees.id",ondelete="CASCADE"),primary_key=True)


class WorkOrderScope(Base):
    __tablename__="work_order_scopes"
    work_order_id=Column(Integer,ForeignKey("work_orders.id",ondelete="CASCADE"),primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    spaces=Column(JSON,nullable=False)


class TaskSpaceStaff(Base):
    __tablename__="task_space_staff"
    __table_args__=(UniqueConstraint("task_id","space_id","employee_id",name="uq_task_space_employee"),)
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    task_id=Column(Integer,ForeignKey("task_items.id",ondelete="CASCADE"),nullable=False,index=True)
    space_id=Column(Integer,ForeignKey("location_zones.id"),nullable=True,index=True)
    space_name=Column(String(100),nullable=False)
    employee_id=Column(Integer,ForeignKey("staff_employees.id"),nullable=False,index=True)
    crew_id=Column(Integer,ForeignKey("work_crews.id"),nullable=True)
    planned_minutes=Column(Integer,nullable=True)


class StaffChecklistProgress(Base):
    __tablename__="staff_checklist_progress"
    allocation_id=Column(Integer,ForeignKey("task_space_staff.id",ondelete="CASCADE"),primary_key=True)
    checklist_id=Column(Integer,ForeignKey("task_checklist_items.id",ondelete="CASCADE"),primary_key=True)
    completed=Column(Boolean,nullable=False,default=False)
    answer=Column(String(5),nullable=True)
    completed_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    completed_at=Column(DateTime(timezone=True),nullable=True)


class QuoteWorkScope(Base):
    __tablename__="quote_work_scopes"
    quote_id=Column(Integer,ForeignKey("quotes.id",ondelete="CASCADE"),primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    location_id=Column(Integer,ForeignKey("locations.id"),nullable=False)
    configuration=Column(JSON,nullable=False)
    opportunity_id=Column(Integer,ForeignKey("client_opportunities.id",ondelete="SET NULL"),nullable=True,index=True)
