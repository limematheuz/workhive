from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QuoteRevision(Base):
    """Immutable commercial snapshot produced when a quote is sent."""

    __tablename__ = "quote_revisions"
    __table_args__ = (
        UniqueConstraint("quote_id", "version", name="uq_quote_revision_version"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    quote_id = Column(
        Integer,
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    version = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)

    quote = relationship("Quote", back_populates="revisions", foreign_keys=[quote_id])
    company = relationship("Company")
    created_by = relationship("User")
