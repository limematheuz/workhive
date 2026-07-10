from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(14, 4), default=1, nullable=False)
    unit_price = Column(Numeric(14, 4), nullable=False)
    tax_rate = Column(Numeric(7, 6), default=0.21, nullable=False)
    subtotal = Column(Numeric(14, 2), nullable=False)
    total = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    invoice_id = Column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    invoice = relationship("Invoice", back_populates="items")

    task_item_id = Column(
        Integer, ForeignKey("task_items.id", ondelete="SET NULL"), nullable=True
    )
    task_item = relationship("TaskItem", back_populates="invoice_items")
