from sqlalchemy import Column,Integer,String,Text,Date,DateTime,JSON,ForeignKey,func
from app.db.session import Base


class LaborCommunication(Base):
    __tablename__="labor_communications"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    employee_id=Column(Integer,ForeignKey("staff_employees.id"),nullable=False)
    recipient_user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    kind=Column(String(30),nullable=False)
    effective_on=Column(Date,nullable=False)
    subject=Column(String(200),nullable=False)
    description=Column(Text,nullable=False)
    document_revision_ids=Column(JSON,nullable=False,default=list)
    status=Column(String(20),nullable=False,default="sent")
    revision=Column(Integer,nullable=False,default=1)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())


class LaborCommunicationEvent(Base):
    __tablename__="labor_communication_events"
    id=Column(Integer,primary_key=True)
    communication_id=Column(Integer,ForeignKey("labor_communications.id"),nullable=False,index=True)
    actor_user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    status=Column(String(20),nullable=False)
    note=Column(Text,nullable=False,default="")
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
