from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)


class TemplateTask(Base):
    __tablename__ = "template_tasks"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_template_tasks_company_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    default_price = Column(Float)
    unit = Column(String(50), nullable=False)
    pricing_mode = Column(String(20), nullable=False, default="fixed")
    # The live projection is kept for existing task and location flows. Every
    # change is also recorded as an immutable ServiceCatalogVersion snapshot.
    catalog_version = Column(Integer, nullable=False, default=1)
    estimated_duration_minutes = Column(Integer, nullable=True)
    requirements = Column(String(2000), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company = relationship("Company", back_populates="template_tasks")

    locations = relationship("LocationTemplate", back_populates="template", cascade="all, delete-orphan")
    catalog_versions = relationship(
        "ServiceCatalogVersion",
        back_populates="template_task",
        cascade="all, delete-orphan",
        order_by="ServiceCatalogVersion.version.desc()",
    )

    task_items = relationship("TaskItem", back_populates="template_task")
