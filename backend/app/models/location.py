from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, func, JSON


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=True)
    photo_url = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    map_url = Column(String(500), nullable=True)
    location_type = Column(String(50), nullable=True, default="private")
    num_bathrooms = Column(Integer, nullable=True, default=0)
    has_garage = Column(Boolean, nullable=True, default=False)
    has_kitchen = Column(Boolean, nullable=True, default=False)
    has_terrace = Column(Boolean, nullable=True, default=False)
    rooms = Column(JSON, nullable=True, default=list)
    max_capacity = Column(Integer, nullable=True, default=0)
    checkout_checklist = Column(JSON, nullable=True, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client", back_populates="locations")

    managing_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    managing_company = relationship(
        "Company",
        back_populates="managed_locations",
        foreign_keys=[managing_company_id],
    )

    owner_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    owner_company = relationship(
        "Company",
        back_populates="owned_locations",
        foreign_keys=[owner_company_id],
    )

    default_service_provider_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    templates = relationship("LocationTemplate", back_populates="location", cascade="all, delete-orphan")
    
    work_sessions = relationship("WorkSession", back_populates="location")

    task_items = relationship("TaskItem", back_populates="location")
    reservations = relationship(
        "Reservation", back_populates="location", cascade="all, delete-orphan"
    )
    company_access = relationship(
        "LocationCompanyAccess", back_populates="location", cascade="all, delete-orphan"
    )
