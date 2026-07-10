from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.db.session import Base


class DataSubjectRequest(Base):
    __tablename__ = "data_subject_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    requested_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    request_type = Column(String(30), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    reason = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)
