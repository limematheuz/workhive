from app.db.session import Base
from sqlalchemy import Column, Integer, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship


class LocationTemplate(Base):
    __tablename__ = "location_templates"

    location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True
    )
    template_task_id = Column(
        Integer, ForeignKey("template_tasks.id", ondelete="CASCADE"), primary_key=True
    )
    custom_price = Column(Float, nullable=True)
    custom_name = Column(String(200), nullable=True)
    custom_description = Column(Text, nullable=True)
    custom_unit = Column(String(50), nullable=True)

    location = relationship("Location", back_populates="templates")
    template = relationship("TemplateTask", back_populates="locations")
