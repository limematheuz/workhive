from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QualityInspectionTemplate(Base):
    """Reusable inspection checklist owned by one operating company."""

    __tablename__ = "quality_inspection_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true", index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    location = relationship("Location")
    created_by = relationship("User")
    items = relationship(
        "QualityInspectionTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="QualityInspectionTemplateItem.position",
    )


class QualityInspectionTemplateItem(Base):
    __tablename__ = "quality_inspection_template_items"
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_quality_template_item_position"),
        CheckConstraint("max_points > 0", name="ck_quality_template_item_points"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("quality_inspection_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    guidance = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=True, server_default="true")
    max_points = Column(Integer, nullable=False, default=1, server_default="1")

    template = relationship("QualityInspectionTemplate", back_populates="items")
