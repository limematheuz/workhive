from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from app.db.session import Base


class AdditionalWork(Base):
    __tablename__ = "additional_work"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text)
    quote_id = Column(Integer, ForeignKey("quotes.id"), unique=True)
    task_id = Column(Integer, ForeignKey("task_items.id"), unique=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
