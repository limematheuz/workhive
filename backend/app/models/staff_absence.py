from sqlalchemy import Column, Date, ForeignKey, Integer, String, UniqueConstraint
from app.db.session import Base


class StaffAbsence(Base):
    __tablename__ = "staff_absences"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("staff_employees.id"), nullable=False)
    substitute_id = Column(Integer, ForeignKey("staff_employees.id"))
    starts_on = Column(Date, nullable=False)
    ends_on = Column(Date, nullable=False)
    kind = Column(String(32), nullable=False)


class StaffReservationDay(Base):
    __tablename__ = "staff_reservation_days"
    __table_args__ = (UniqueConstraint("employee_id", "day", name="uq_staff_reservation_day"),)
    id = Column(Integer, primary_key=True)
    absence_id = Column(Integer, ForeignKey("staff_absences.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("staff_employees.id"), nullable=False)
    day = Column(Date, nullable=False)
