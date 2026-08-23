from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationZone(Base):
    __tablename__ = "location_zones"

    id = Column(Integer, primary_key=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    zone_type = Column(String(50), nullable=False, default="other")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", back_populates="zones")
    task_selections = relationship("TaskZone", back_populates="zone")


class TaskZone(Base):
    __tablename__ = "task_zones"
    __table_args__ = (
        UniqueConstraint("task_id", "zone_id", name="uq_task_zone"),
    )

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer,
        ForeignKey("task_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_id = Column(
        Integer,
        ForeignKey("location_zones.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    zone_name = Column(String(100), nullable=False)
    zone_type = Column(String(50), nullable=False)

    task = relationship("TaskItem", back_populates="zones")
    zone = relationship("LocationZone", back_populates="task_selections")

    @property
    def name(self) -> str:
        return self.zone_name
