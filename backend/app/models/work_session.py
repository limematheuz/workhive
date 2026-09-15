from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id = Column(Integer, primary_key=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(500), nullable=True)
    start_latitude = Column(Float, nullable=True)
    start_longitude = Column(Float, nullable=True)
    start_accuracy_meters = Column(Float, nullable=True)
    end_latitude = Column(Float, nullable=True)
    end_longitude = Column(Float, nullable=True)
    end_accuracy_meters = Column(Float, nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    paused_seconds = Column(Integer, nullable=False, default=0, server_default="0")
    # Internal financial snapshots are intentionally excluded from standard
    # time-session responses.  They are only exposed through the protected
    # labour-cost workspace.
    labor_cost_company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    labor_cost_membership_id = Column(Integer, nullable=True, index=True)
    labor_cost_rate_snapshot = Column(Numeric(10, 2), nullable=True)
    labor_cost_amount_snapshot = Column(Numeric(12, 2), nullable=True)
    # A person can belong to several teams. The responsible team is therefore
    # captured from the session location once it closes, instead of deriving it
    # later from mutable membership or location assignments.
    labor_cost_team_id = Column(Integer, nullable=True, index=True)
    labor_cost_team_name_snapshot = Column(String(120), nullable=True)
    labor_cost_team_snapshotted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="work_sessions")

    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    location = relationship("Location", back_populates="work_sessions")

    task_item_id = Column(
        Integer, ForeignKey("task_items.id", ondelete="SET NULL"), nullable=True
    )
    task_item = relationship("TaskItem", back_populates="work_sessions")
    pauses = relationship(
        "WorkSessionPause",
        back_populates="work_session",
        cascade="all, delete-orphan",
        order_by="WorkSessionPause.started_at",
    )

    @property
    def location_name(self) -> str | None:
        return self.location.name if self.location else None
