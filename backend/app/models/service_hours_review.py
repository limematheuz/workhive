from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from app.db.session import Base


class ServiceHoursReview(Base):
    __tablename__ = "service_hours_reviews"
    task_id = Column(Integer, ForeignKey("task_items.id", ondelete="CASCADE"), primary_key=True)
    contract_minutes = Column(Integer)
    approved_seconds = Column(Integer)
    session_signature = Column(String(64))
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
