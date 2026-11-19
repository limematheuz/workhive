from sqlalchemy import Column,ForeignKey,Integer,Numeric,String,Date,DateTime,func,CheckConstraint
from app.db.session import Base


class Subcontract(Base):
    __tablename__="subcontracts"
    __table_args__=(CheckConstraint("status IN ('planned','progress','completed','cancelled')",name="ck_subcontract_status"),)
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    work_order_id=Column(Integer,ForeignKey("work_orders.id"),nullable=False,index=True)
    supplier_id=Column(Integer,ForeignKey("inventory_suppliers.id"),nullable=False)
    amount=Column(Numeric(12,2),nullable=False)
    description=Column(String(255),nullable=False)
    document_url=Column(String(2000),nullable=True)
    document_expires_on=Column(Date,nullable=True)
    status=Column(String(20),nullable=False,default="planned")
    expense_id=Column(Integer,ForeignKey("expenses.id"),nullable=True,unique=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now(),nullable=False)
