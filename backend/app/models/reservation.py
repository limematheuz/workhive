from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    check_in_at = Column(DateTime(timezone=True), nullable=False, index=True)
    check_out_at = Column(DateTime(timezone=True), nullable=False, index=True)
    guest_count = Column(Integer, nullable=False, default=1)
    stay_type = Column(String(20), nullable=False, default="guest")
    status = Column(String(20), nullable=False, default="confirmed")
    source = Column(String(20), nullable=False, default="manual")
    external_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    cleaning_required = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    location = relationship("Location", back_populates="reservations")

    owner_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    owner_company = relationship(
        "Company",
        back_populates="owned_reservations",
        foreign_keys=[owner_company_id],
    )

    assigned_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_company = relationship("Company", foreign_keys=[assigned_company_id])
    cleaning_scheduled_at = Column(DateTime(timezone=True), nullable=True)
    service_request_sent_at = Column(DateTime(timezone=True), nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    updated_by = relationship("User", foreign_keys=[updated_by_user_id])

    @property
    def owner_company_name(self) -> str | None:
        return self.owner_company.name if self.owner_company else None

    @property
    def created_by_user_name(self) -> str | None:
        if not self.created_by:
            return None
        return self.created_by.full_name or self.created_by.email

    @property
    def assigned_company_name(self) -> str | None:
        return self.assigned_company.name if self.assigned_company else None

    checkout_tasks = relationship(
        "TaskItem",
        foreign_keys="TaskItem.checkout_reservation_id",
        back_populates="checkout_reservation",
    )
    next_checkin_tasks = relationship(
        "TaskItem",
        foreign_keys="TaskItem.next_reservation_id",
        back_populates="next_reservation",
    )
