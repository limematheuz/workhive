from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.session import Base


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(255), nullable=False, unique=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
