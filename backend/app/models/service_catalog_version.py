from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ServiceCatalogVersion(Base):
    """Immutable commercial and operational snapshot of a service definition."""

    __tablename__ = "service_catalog_versions"
    __table_args__ = (
        CheckConstraint(
            "estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0",
            name="ck_service_catalog_version_duration_positive",
        ),
        CheckConstraint(
            "pricing_mode IN ('fixed', 'hourly')",
            name="ck_service_catalog_version_pricing_mode",
        ),
        UniqueConstraint(
            "template_task_id",
            "version",
            name="uq_service_catalog_version_template_version",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_task_id = Column(
        Integer,
        ForeignKey("template_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, nullable=False)
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    default_price = Column(Float, nullable=True)
    unit = Column(String(50), nullable=False)
    pricing_mode = Column(String(20), nullable=False, default="fixed")
    estimated_duration_minutes = Column(Integer, nullable=True)
    requirements = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    template_task = relationship("TemplateTask", back_populates="catalog_versions")
