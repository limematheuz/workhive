from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), index=True)
    photo_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    session_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", back_populates = "users")

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")
    company_memberships = relationship("CompanyMembership", back_populates="user")

    work_sessions = relationship("WorkSession", back_populates="user")

    task_items = relationship(
        "TaskItem", foreign_keys="TaskItem.user_id", back_populates="user"
    )
    accepted_tasks = relationship(
        "TaskItem",
        foreign_keys="TaskItem.accepted_by_user_id",
        back_populates="accepted_by",
    )

    @property
    def active_location_id(self) -> int | None:
        for session in self.work_sessions:
            if session.end_time is None:
                return session.location_id
        return None

    @property
    def active_location_name(self) -> str | None:
        for session in self.work_sessions:
            if session.end_time is None:
                return session.location.name if session.location else None
        return None
