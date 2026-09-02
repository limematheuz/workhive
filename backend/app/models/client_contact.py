from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ClientContact(Base):
    """A person who represents a commercial account within one company."""

    __tablename__ = "client_contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name = Column(String(120), nullable=False)
    email = Column(String(254), nullable=True, index=True)
    phone = Column(String(30), nullable=True)
    job_title = Column(String(120), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    client = relationship("Client", back_populates="contacts")
    roles = relationship(
        "ClientContactRole",
        back_populates="contact",
        cascade="all, delete-orphan",
    )

    @property
    def role_codes(self) -> list[str]:
        return sorted(assignment.role for assignment in self.roles)


class ClientContactRole(Base):
    """One or more responsibilities held by a contact for the same account."""

    __tablename__ = "client_contact_roles"
    __table_args__ = (
        CheckConstraint(
            "role IN ('commercial', 'billing', 'operations', 'quality', 'emergency', 'general')",
            name="ck_client_contact_role_value",
        ),
        UniqueConstraint(
            "client_contact_id",
            "role",
            name="uq_client_contact_role",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_contact_id = Column(
        Integer,
        ForeignKey("client_contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(30), nullable=False, index=True)

    contact = relationship("ClientContact", back_populates="roles")
