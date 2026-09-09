from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ServiceContract(Base):
    """A service agreement created from one accepted quote revision."""

    __tablename__ = "service_contracts"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "contract_number",
            name="uq_company_service_contract_number",
        ),
        UniqueConstraint("source_quote_id", name="uq_service_contract_source_quote"),
        CheckConstraint(
            "status IN ('draft', 'active', 'terminated')",
            name="ck_service_contract_status",
        ),
        CheckConstraint(
            "renewal_mode IN ('manual', 'automatic')",
            name="ck_service_contract_renewal_mode",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_number = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="draft", index=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    renewal_mode = Column(String(20), nullable=False, default="manual")
    renewal_notice_days = Column(Integer, nullable=False, default=30)
    response_time_hours = Column(Integer, nullable=True)
    resolution_time_hours = Column(Integer, nullable=True)
    service_window = Column(String(1000), nullable=True)
    notes = Column(Text, nullable=True)
    quote_snapshot = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_quote_id = Column(
        Integer,
        ForeignKey("quotes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_quote_revision_id = Column(
        Integer,
        ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    company = relationship("Company", back_populates="service_contracts")
    client = relationship("Client", back_populates="service_contracts")
    source_quote = relationship("Quote", back_populates="service_contract")
    source_quote_revision = relationship("QuoteRevision")
    created_by = relationship("User")
    service_lines = relationship(
        "ServiceContractLine",
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ServiceContractLine.position",
    )
    covered_locations = relationship(
        "ServiceContractLocation",
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ServiceContractLocation.id",
    )


class ServiceContractLine(Base):
    """Immutable commercial line copied from the accepted quote snapshot."""

    __tablename__ = "service_contract_lines"
    __table_args__ = (
        UniqueConstraint(
            "contract_id",
            "position",
            name="uq_service_contract_line_position",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(
        Integer,
        ForeignKey("service_contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False)
    description = Column(String(1000), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    contract = relationship("ServiceContract", back_populates="service_lines")


class ServiceContractLocation(Base):
    """A location covered by a contract, retained when its coverage ends."""

    __tablename__ = "service_contract_locations"
    __table_args__ = (
        UniqueConstraint(
            "contract_id",
            "location_id",
            name="uq_service_contract_location",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(
        Integer,
        ForeignKey("service_contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    covered_from = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    covered_until = Column(DateTime(timezone=True), nullable=True)

    contract = relationship("ServiceContract", back_populates="covered_locations")
    location = relationship("Location", back_populates="service_contract_links")
    covered_zones = relationship(
        "ServiceContractLocationZone",
        back_populates="contract_location",
        cascade="all, delete-orphan",
        order_by="ServiceContractLocationZone.id",
    )

    @property
    def location_name(self) -> str | None:
        return self.location.name if self.location is not None else None


class ServiceContractLocationZone(Base):
    """An optional space restriction inside one covered contract location."""

    __tablename__ = "service_contract_location_zones"
    __table_args__ = (
        UniqueConstraint(
            "contract_location_id",
            "zone_id",
            name="uq_service_contract_location_zone",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_location_id = Column(
        Integer,
        ForeignKey("service_contract_locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_id = Column(
        Integer,
        ForeignKey("location_zones.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    contract_location = relationship(
        "ServiceContractLocation",
        back_populates="covered_zones",
    )
    zone = relationship("LocationZone")

    @property
    def zone_name(self) -> str | None:
        return self.zone.name if self.zone is not None else None
