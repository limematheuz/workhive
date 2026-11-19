from sqlalchemy.orm import relationship
from sqlalchemy import Column,Date,DateTime,ForeignKey,Integer,Numeric,String,Text,func
from app.db.session import Base


class InternalRequest(Base):
    __tablename__ = "internal_requests"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    employee_id=Column(Integer,ForeignKey("staff_employees.id"),nullable=False)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    kind=Column(String(30),nullable=False)
    description=Column(Text,nullable=False)
    starts_on=Column(Date,nullable=False)
    ends_on=Column(Date,nullable=False)
    amount=Column(Numeric(12,2),nullable=False,default=0)
    status=Column(String(20),nullable=False,default="pending")
    reviewed_by=Column(Integer,ForeignKey("users.id"))
    reviewed_at=Column(DateTime(timezone=True))
    absence_id=Column(Integer,ForeignKey("staff_absences.id"),unique=True)
    purchase_links=relationship("PurchaseBudgetLink",foreign_keys="PurchaseBudgetLink.request_id",back_populates="request")
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())

    @property
    def purchase_link(self):
        return next((link for link in self.purchase_links if link.active_request_id is not None),None)
