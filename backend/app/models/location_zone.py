from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, func
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
    parent_id = Column(
        Integer,
        ForeignKey("location_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = Column(String(100), nullable=False)
    zone_type = Column(String(50), nullable=False, default="other")
    attributes = Column(JSON, nullable=False, default=dict)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", back_populates="zones")
    parent = relationship(
        "LocationZone",
        remote_side="LocationZone.id",
        back_populates="children",
    )
    children = relationship("LocationZone", back_populates="parent")
    task_selections = relationship("TaskZone", back_populates="zone")
    task_templates = relationship(
        "LocationSpaceTaskTemplate",
        back_populates="space",
        cascade="all, delete-orphan",
        order_by="LocationSpaceTaskTemplate.sort_order",
    )

    @property
    def tasks(self):
        return [task for task in self.task_templates if task.is_active]

    @property
    def space_type(self) -> str:
        return self.zone_type


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

    @property
    def space_id(self) -> int:
        return self.zone_id


class LocationSpaceTaskTemplate(Base):
    __tablename__ = "location_space_task_templates"

    id = Column(Integer, primary_key=True)
    location_space_id = Column(
        Integer,
        ForeignKey("location_zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(160), nullable=False)
    category = Column(String(50), nullable=False, default="cleaning")
    frequency = Column(String(30), nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    space = relationship("LocationZone", back_populates="task_templates")
