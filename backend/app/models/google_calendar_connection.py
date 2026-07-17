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


class GoogleCalendarConnection(Base):
    __tablename__ = "google_calendar_connections"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            name="uq_google_calendar_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connected_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    owner_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    google_account_email = Column(String(255), nullable=True)
    calendar_id = Column(String(1024), nullable=False)
    calendar_name = Column(String(255), nullable=False)
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    sync_token = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="connected")
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company")
    connected_by = relationship("User", foreign_keys=[connected_by_user_id])
    owner_user = relationship("User", foreign_keys=[owner_user_id])
