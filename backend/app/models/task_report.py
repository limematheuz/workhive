from sqlalchemy import (
    CheckConstraint,
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


class TaskReport(Base):
    __tablename__ = "task_reports"
    __table_args__ = (
        CheckConstraint(
            "report_type IN ('issue', 'note', 'photo', 'checklist_note', 'checklist_photo')",
            name="ck_task_reports_type",
        ),
        UniqueConstraint(
            "reporter_user_id",
            "client_event_id",
            name="uq_task_report_user_event",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_item_id = Column(
        Integer,
        ForeignKey("task_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reporter_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reporter_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requesting_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    checklist_item_id = Column(
        Integer,
        ForeignKey("task_checklist_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    client_event_id = Column(String(64), nullable=False)
    report_type = Column(String(30), nullable=False, index=True)
    title = Column(String(160), nullable=True)
    description = Column(Text, nullable=True)
    issue_type = Column(String(80), nullable=True)
    element = Column(String(80), nullable=True)
    media_key = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    reporter_name = Column(String(255), nullable=False)
    checklist_item_label = Column(String(500), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    task_item = relationship("TaskItem")
    reporter = relationship("User", foreign_keys=[reporter_user_id])
    reporter_company = relationship("Company", foreign_keys=[reporter_company_id])
    requesting_company = relationship("Company", foreign_keys=[requesting_company_id])
    checklist_item = relationship("TaskChecklistItem")
