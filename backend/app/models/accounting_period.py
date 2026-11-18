from sqlalchemy import Column,Integer,String,Text,DateTime,ForeignKey,JSON,UniqueConstraint,CheckConstraint,func
from app.db.session import Base


class AccountingPeriod(Base):
    __tablename__="accounting_periods"
    __table_args__=(UniqueConstraint("company_id","month",name="uq_accounting_period_company_month"),CheckConstraint("status IN ('open','closed')",name="ck_accounting_period_status"))
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True)
    month=Column(String(7),nullable=False)
    status=Column(String(10),nullable=False,default="open")
    revision=Column(Integer,nullable=False,default=0)
    snapshot=Column(JSON,nullable=True)
    closed_at=Column(DateTime(timezone=True),nullable=True)
    closed_by=Column(Integer,ForeignKey("users.id",ondelete="SET NULL"),nullable=True)
    reopened_at=Column(DateTime(timezone=True),nullable=True)
    reopened_by=Column(Integer,ForeignKey("users.id",ondelete="SET NULL"),nullable=True)


class AccountingPeriodEvent(Base):
    __tablename__="accounting_period_events"
    id=Column(Integer,primary_key=True)
    period_id=Column(Integer,ForeignKey("accounting_periods.id",ondelete="CASCADE"),nullable=False,index=True)
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True)
    action=Column(String(10),nullable=False)
    revision=Column(Integer,nullable=False)
    reason=Column(Text,nullable=False)
    actor_id=Column(Integer,ForeignKey("users.id",ondelete="SET NULL"),nullable=True)
    snapshot=Column(JSON,nullable=True)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
