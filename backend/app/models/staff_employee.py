from sqlalchemy import JSON, Column, ForeignKey, Integer, Numeric, String
from app.db.session import Base


class StaffEmployee(Base):
    __tablename__ = "staff_employees"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(140), nullable=False)
    position = Column(String(120), nullable=False)
    team = Column(String(120), nullable=False)
    monthly_hours = Column(Numeric(6, 2), nullable=False)
    hourly_cost = Column(Numeric(10, 2), nullable=False)
    profile = Column(JSON, nullable=True)
    history = Column(JSON, nullable=True)
