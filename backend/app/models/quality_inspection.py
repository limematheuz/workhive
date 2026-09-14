from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QualityInspection(Base):
    """A completed or in-progress inspection with a frozen checklist snapshot."""

    __tablename__ = "quality_inspections"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'completed')", name="ck_quality_inspection_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("quality_inspection_templates.id", ondelete="SET NULL"), nullable=True, index=True)
    template_title = Column(String(160), nullable=False)
    status = Column(String(20), nullable=False, default="draft", server_default="draft", index=True)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    location = relationship("Location")
    template = relationship("QualityInspectionTemplate")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    completed_by = relationship("User", foreign_keys=[completed_by_user_id])
    items = relationship(
        "QualityInspectionItem",
        back_populates="inspection",
        cascade="all, delete-orphan",
        order_by="QualityInspectionItem.position",
    )
    evidence = relationship(
        "QualityEvidence",
        back_populates="inspection",
        cascade="all, delete-orphan",
        order_by="QualityEvidence.created_at",
    )
    conformity = relationship(
        "QualityInspectionConformity",
        back_populates="inspection",
        cascade="all, delete-orphan",
        uselist=False,
    )


class QualityInspectionConformity(Base):
    """An immutable internal acknowledgement of a completed inspection."""

    __tablename__ = "quality_inspection_conformities"
    __table_args__ = (
        UniqueConstraint("inspection_id", name="uq_quality_inspection_conformity_inspection"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_id = Column(
        Integer,
        ForeignKey("quality_inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    signed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    signer_name = Column(String(255), nullable=False)
    statement_version = Column(String(40), nullable=False)
    signed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    inspection = relationship("QualityInspection", back_populates="conformity")
    signed_by = relationship("User", foreign_keys=[signed_by_user_id])


class QualityInspectionItem(Base):
    __tablename__ = "quality_inspection_items"
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_quality_inspection_item_position"),
        CheckConstraint("max_points > 0", name="ck_quality_inspection_item_points"),
        CheckConstraint("status IN ('not_assessed', 'passed', 'failed')", name="ck_quality_inspection_item_status"),
        CheckConstraint("points_awarded >= 0", name="ck_quality_inspection_item_awarded"),
        CheckConstraint("points_awarded <= max_points", name="ck_quality_inspection_item_awarded_max"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    template_item_id = Column(Integer, ForeignKey("quality_inspection_template_items.id", ondelete="SET NULL"), nullable=True)
    position = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    guidance = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=True, server_default="true")
    max_points = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="not_assessed", server_default="not_assessed")
    points_awarded = Column(Integer, nullable=False, default=0, server_default="0")
    notes = Column(Text, nullable=True)

    inspection = relationship("QualityInspection", back_populates="items")
    template_item = relationship("QualityInspectionTemplateItem")
