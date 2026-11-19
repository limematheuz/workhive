from sqlalchemy import Column,Integer,ForeignKey,String,Text,DateTime,func
from app.db.session import Base


class AdvisoryRequest(Base):
    __tablename__="advisory_requests"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    requested_by=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    area=Column(String(20),nullable=False)
    description=Column(String(2000),nullable=False)
    response=Column(Text,nullable=True)
    answered_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now(),nullable=False)
    answered_at=Column(DateTime(timezone=True),nullable=True)
