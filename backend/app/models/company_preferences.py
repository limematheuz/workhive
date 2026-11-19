from sqlalchemy import Column, ForeignKey, Integer, String
from app.db.session import Base


class CompanyPreferences(Base):
    __tablename__ = "company_preferences"
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    country = Column(String(2), nullable=False, default="ES")
    currency = Column(String(3), nullable=False, default="EUR")
    timezone = Column(String(80), nullable=False, default="Europe/Madrid")
    language = Column(String(8), nullable=False, default="es")
