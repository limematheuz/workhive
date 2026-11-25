from sqlalchemy import CheckConstraint, Column, DateTime, Integer, func

from app.db.session import Base


class PlatformSetup(Base):
    __tablename__ = "platform_setup"
    __table_args__ = (CheckConstraint("id = 1", name="ck_platform_setup_singleton"),)

    id = Column(Integer, primary_key=True, autoincrement=False)
    completed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
