"""Explicit, versioned customer copies of otherwise private execution reports."""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, ForeignKeyConstraint, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class TaskClientPublication(Base):
    __tablename__ = "task_client_publications"
    __table_args__ = (
        UniqueConstraint("task_id", "revision", name="uq_task_client_publication_revision"),
        ForeignKeyConstraint(["client_id", "company_id"], ["clients.id", "clients.company_id"], ondelete="CASCADE", name="fk_task_client_publication_customer"),
        CheckConstraint("revision > 0", name="ck_task_client_publication_revision"),
    )
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("task_items.id", ondelete="CASCADE"), nullable=False, index=True)
    revision = Column(Integer, nullable=False)
    manifest = Column(JSON, nullable=False)
    manifest_hash = Column(String(64), nullable=False)
    published_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    photos = relationship("TaskClientPublicationPhoto", back_populates="publication", cascade="all, delete-orphan")
    acceptance = relationship("TaskClientAcceptance", back_populates="publication", uselist=False, cascade="all, delete-orphan")


class TaskClientPublicationPhoto(Base):
    __tablename__ = "task_client_publication_photos"
    id = Column(String(36), primary_key=True)
    publication_id = Column(Integer, ForeignKey("task_client_publications.id", ondelete="CASCADE"), nullable=False, index=True)
    source_report_id = Column(Integer, ForeignKey("task_reports.id", ondelete="SET NULL"), nullable=True)
    media_key = Column(String(500), nullable=False, unique=True)
    content_type = Column(String(80), nullable=False)
    file_name = Column(String(255), nullable=False)
    sha256 = Column(String(64), nullable=False)
    byte_size = Column(Integer, nullable=False)
    publication = relationship("TaskClientPublication", back_populates="photos")


class TaskClientAcceptance(Base):
    __tablename__ = "task_client_acceptances"
    publication_id = Column(Integer, ForeignKey("task_client_publications.id", ondelete="CASCADE"), primary_key=True)
    grant_id = Column(Integer, ForeignKey("client_portal_grants.id", ondelete="SET NULL"), nullable=True)
    accepted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    signer_name = Column(String(255), nullable=False)
    statement_version = Column(String(80), nullable=False)
    manifest_hash = Column(String(64), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=False)
    publication = relationship("TaskClientPublication", back_populates="acceptance")
