from sqlalchemy import Column,ForeignKey,Integer,Numeric,CheckConstraint
from app.db.session import Base


class QuoteCostEstimate(Base):
    __tablename__="quote_cost_estimates"
    __table_args__=(CheckConstraint("labor_amount IS NULL OR labor_amount >= 0",name="ck_quote_estimate_exact_labor"),)
    quote_id=Column(Integer,ForeignKey("quotes.id",ondelete="CASCADE"),primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    revision=Column(Integer,nullable=False)
    labor_amount=Column(Numeric(12,2),nullable=True)
    labor_hours=Column(Numeric(12,2),nullable=False)
    hourly_cost=Column(Numeric(12,2),nullable=False)
    materials=Column(Numeric(12,2),nullable=False)
    other_costs=Column(Numeric(12,2),nullable=False)
    updated_by=Column(Integer,ForeignKey("users.id"),nullable=False)
