from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Text, JSON, func
from app.db.session import Base


class TaskItem(Base):
    __tablename__ = "task_items"

    id = Column(Integer, primary_key=True)
    title = Column(String(150), nullable=False)
    description = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    operational_notes = Column(JSON, nullable=False, default=list)
    attachments = Column(JSON, nullable=False, default=list)
    checklist_evidence = Column(JSON, nullable=False, default=dict)
    reported_issues = Column(JSON, nullable=False, default=list)
    price = Column(Float, nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=False)
    # fixed: price × quantity. hourly: price is €/h × worked_seconds_snapshot.
    pricing_mode = Column(String(20), nullable=False, default="fixed")
    # The agreed billing terms are copied here the first time work starts.
    # Invoices use this snapshot instead of mutable operational task fields.
    pricing_locked_at = Column(DateTime(timezone=True), nullable=True)
    billing_pricing_mode_snapshot = Column(String(20), nullable=True)
    billing_price_snapshot = Column(Float, nullable=True)
    billing_quantity_snapshot = Column(Float, nullable=True)
    billing_unit_snapshot = Column(String(50), nullable=True)
    worked_seconds_snapshot = Column(Integer, nullable=True)
    status = Column(String(20), default="accepted", nullable=False)
    priority = Column(String(20), default="medium", nullable=False)
    scheduled_start_at = Column(DateTime(timezone=True), nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    date_done = Column(DateTime(timezone=True))
    service_context = Column(String(30), nullable=False, default="standalone")
    is_invoiced = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    company = relationship("Company")

    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    location = relationship("Location", back_populates="task_items")

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship(
        "User", foreign_keys=[user_id], back_populates="task_items"
    )

    accepted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_by = relationship(
        "User", foreign_keys=[accepted_by_user_id], back_populates="accepted_tasks"
    )

    template_task_id = Column(Integer, ForeignKey("template_tasks.id"), nullable=True)
    template_task = relationship("TemplateTask", back_populates="task_items")

    # The template is the current service definition; this reference preserves
    # the exact immutable catalog revision selected when the work was created.
    service_catalog_version_id = Column(
        Integer,
        ForeignKey("service_catalog_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    service_catalog_version = relationship("ServiceCatalogVersion")

    checkout_reservation_id = Column(
        Integer, ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True
    )
    checkout_reservation = relationship(
        "Reservation",
        foreign_keys=[checkout_reservation_id],
        back_populates="checkout_tasks",
    )

    next_reservation_id = Column(
        Integer, ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True
    )
    next_reservation = relationship(
        "Reservation",
        foreign_keys=[next_reservation_id],
        back_populates="next_checkin_tasks",
    )

    invoice_items = relationship("InvoiceItem", back_populates="task_item")
    work_sessions = relationship("WorkSession", back_populates="task_item")
    assignments = relationship(
        "TaskAssignment",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskAssignment.id",
    )
    checklist_items = relationship(
        "TaskChecklistItem",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskChecklistItem.position",
    )
    zones = relationship(
        "TaskZone",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskZone.id",
    )

    @property
    def user_company_id(self) -> int | None:
        return self.user.company_id if self.user else None

    @property
    def accepted_by_name(self) -> str | None:
        if not self.accepted_by:
            return None
        return self.accepted_by.full_name or self.accepted_by.email

    @property
    def spaces(self):
        """New name for the existing task-zone snapshot relation.

        The database deliberately retains ``task_zones`` so existing tasks and
        integrations keep working, while new product language can consistently
        refer to the physical areas as spaces.
        """
        return self.zones
