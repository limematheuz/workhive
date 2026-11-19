from sqlalchemy import Column,DateTime,ForeignKey,Integer,String,UniqueConstraint,func
from app.db.session import Base


class StaffAccount(Base):
    __tablename__ = "staff_accounts"
    __table_args__ = (UniqueConstraint("company_id","user_id",name="uq_staff_company_account"),)
    employee_id = Column(Integer,ForeignKey("staff_employees.id",ondelete="CASCADE"),primary_key=True)
    company_id = Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    user_id = Column(Integer,ForeignKey("users.id"),nullable=False)


class StaffDocumentReceipt(Base):
    __tablename__ = "staff_document_receipts"
    __table_args__ = (UniqueConstraint("employee_id","user_id","digest",name="uq_staff_document_receipt"),)
    id = Column(Integer,primary_key=True)
    employee_id = Column(Integer,ForeignKey("staff_employees.id"),nullable=False)
    user_id = Column(Integer,ForeignKey("users.id"),nullable=False)
    digest = Column(String(64),nullable=False)
    acknowledged_at = Column(DateTime(timezone=True),nullable=False,server_default=func.now())
