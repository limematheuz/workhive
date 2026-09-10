from sqlalchemy import Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class WorkSessionPause(Base):
    __tablename__ = "work_session_pauses"

    id = Column(Integer, primary_key=True)
    work_session_id = Column(
        Integer,
        ForeignKey("work_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    work_session = relationship("WorkSession", back_populates="pauses")
