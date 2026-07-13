from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_assignment_user"),
    )

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer,
        ForeignKey("task_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="pending")
    source = Column(String(20), nullable=False, default="checklist")

    task = relationship("TaskItem", back_populates="assignments")
    user = relationship("User")

    @property
    def user_name(self) -> str:
        return self.user.full_name or self.user.email


class TaskChecklistItem(Base):
    __tablename__ = "task_checklist_items"
    __table_args__ = (
        UniqueConstraint("task_id", "position", name="uq_task_checklist_position"),
    )

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer,
        ForeignKey("task_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False)
    source_line_index = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    completed = Column(Boolean, nullable=False, default=False)

    task = relationship("TaskItem", back_populates="checklist_items")
    assignments = relationship(
        "TaskChecklistAssignment",
        back_populates="checklist_item",
        cascade="all, delete-orphan",
        order_by="TaskChecklistAssignment.id",
    )


class TaskChecklistAssignment(Base):
    __tablename__ = "task_checklist_assignments"
    __table_args__ = (
        UniqueConstraint(
            "checklist_item_id",
            "user_id",
            name="uq_task_checklist_assignment_user",
        ),
    )

    id = Column(Integer, primary_key=True)
    checklist_item_id = Column(
        Integer,
        ForeignKey("task_checklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="pending")

    checklist_item = relationship("TaskChecklistItem", back_populates="assignments")
    user = relationship("User")

    @property
    def user_name(self) -> str:
        return self.user.full_name or self.user.email
