from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class TaskCalendarEvent(Base):
    __tablename__ = "task_calendar_events"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "user_id",
            "task_id",
            name="uq_calendar_event_company_user_task",
        ),
        UniqueConstraint(
            "company_id",
            "user_id",
            "external_event_id",
            name="uq_calendar_event_company_user_external",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id = Column(
        Integer,
        ForeignKey("task_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_event_id = Column(String(1024), nullable=False)
    external_html_link = Column(Text, nullable=True)
    etag = Column(String(255), nullable=True)
    google_updated_at = Column(DateTime(timezone=True), nullable=True)
    last_task_updated_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    task = relationship("TaskItem")
    user = relationship("User")
