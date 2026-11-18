from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from app.db.session import Base


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer,primary_key=True)
    company_id = Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    registration = Column(String(30),nullable=False)
    name = Column(String(140),nullable=False)
    odometer = Column(Numeric(12,1),nullable=False,default=0)
    service_due_on = Column(Date)
    status = Column(String(20),nullable=False,default="active")


class VehicleJourney(Base):
    __tablename__ = "vehicle_journeys"
    id = Column(Integer,primary_key=True)
    vehicle_id = Column(Integer,ForeignKey("vehicles.id"),nullable=False,index=True)
    employee_id = Column(Integer,ForeignKey("staff_employees.id"),nullable=False)
    location_id = Column(Integer,ForeignKey("locations.id"),nullable=False)
    starts_at = Column(DateTime(timezone=True),nullable=False)
    ends_at = Column(DateTime(timezone=True),nullable=False)
    start_km = Column(Numeric(12,1),nullable=False)
    end_km = Column(Numeric(12,1),nullable=False)
    notes = Column(Text)


class ResourceCustody(Base):
    __tablename__ = "resource_custody"
    id = Column(Integer,primary_key=True)
    equipment_id = Column(Integer,ForeignKey("location_equipment.id"),nullable=False,index=True)
    employee_id = Column(Integer,ForeignKey("staff_employees.id"),nullable=False)
    delivered_by = Column(Integer,ForeignKey("users.id"),nullable=False)
    delivered_at = Column(DateTime(timezone=True),nullable=False,server_default=func.now())
    returned_at = Column(DateTime(timezone=True))
    returned_to = Column(Integer,ForeignKey("users.id"))
    notes = Column(Text)
