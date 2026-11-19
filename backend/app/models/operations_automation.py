from sqlalchemy import Boolean,Column,DateTime,ForeignKey,Integer,String
from app.db.session import Base


class OperationsAutomation(Base):
    __tablename__="operations_automations"
    company_id=Column(Integer,ForeignKey("companies.id"),primary_key=True)
    recurring=Column(Boolean,nullable=False,default=False)
    documents=Column(Boolean,nullable=False,default=False)
    incidents=Column(Boolean,nullable=False,default=False)
    horizon_days=Column(Integer,nullable=False,default=7)
    last_run=Column(DateTime(timezone=True))
    last_result=Column(String(2000))
