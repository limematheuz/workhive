from sqlalchemy import Column, DateTime, ForeignKey, Integer
from app.db.session import Base


class StaffShift(Base):
    __tablename__ = "staff_shifts"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("staff_employees.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("task_items.id"))
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False)
