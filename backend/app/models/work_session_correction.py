from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class WorkSessionCorrection(Base):
    __tablename__ = "work_session_corrections"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_work_session_corrections_status",
        ),
        Index(
            "uq_work_session_corrections_pending_per_session",
            "work_session_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    work_session_id = Column(
        Integer,
        ForeignKey("work_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    original_start_time = Column(DateTime(timezone=True), nullable=False)
    original_end_time = Column(DateTime(timezone=True), nullable=False)
    requested_start_time = Column(DateTime(timezone=True), nullable=False)
    requested_end_time = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    reviewed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    work_session = relationship("WorkSession")
    requested_by = relationship("User", foreign_keys=[requested_by_user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])

    @property
    def requester_name(self) -> str | None:
        if not self.requested_by:
            return None
        return self.requested_by.full_name or self.requested_by.email

    @property
    def location_id(self) -> int | None:
        return self.work_session.location_id if self.work_session else None

    @property
    def location_name(self) -> str | None:
        if not self.work_session or not self.work_session.location:
            return None
        return self.work_session.location.name
