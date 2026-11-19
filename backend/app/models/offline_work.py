from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from app.db.session import Base


class OfflineWork(Base):
    __tablename__ = "offline_work"
    __table_args__ = (UniqueConstraint("user_id","event_id",name="uq_offline_work_user_event"),)
    id = Column(Integer,primary_key=True)
    company_id = Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    user_id = Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    task_id = Column(Integer,ForeignKey("task_items.id"),nullable=False,index=True)
    event_id = Column(String(64),nullable=False)
    starts_at = Column(DateTime(timezone=True),nullable=False)
    ends_at = Column(DateTime(timezone=True),nullable=False)
    paused_seconds = Column(Integer,nullable=False,default=0)
    checklist_ids = Column(JSON,nullable=False,default=list)
    description = Column(Text,nullable=False)
    status = Column(String(20),nullable=False,default="pending")
    reviewed_by = Column(Integer,ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    session_id = Column(Integer,ForeignKey("work_sessions.id"),unique=True)
    created_at = Column(DateTime(timezone=True),nullable=False,server_default=func.now())
