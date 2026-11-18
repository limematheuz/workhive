from sqlalchemy import Boolean, Column, ForeignKey, Integer
from app.db.session import Base


class AdvisoryAccess(Base):
    __tablename__ = "advisory_access"
    grant_id = Column(Integer, ForeignKey("external_access_grants.id", ondelete="CASCADE"), primary_key=True)
    accounting = Column(Boolean, nullable=False, default=True)
    payroll = Column(Boolean, nullable=False, default=False)
    can_close_periods = Column(Boolean, nullable=False, default=False)
