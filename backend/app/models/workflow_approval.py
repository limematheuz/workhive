from sqlalchemy.orm import relationship
from sqlalchemy import CheckConstraint,Column,Integer,ForeignKey,Boolean,String,Text,JSON,DateTime,func
from app.db.session import Base


class OperationsApprovalPolicy(Base):
    __tablename__="operations_approval_policies"
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),primary_key=True)
    purchases_required=Column(Boolean,nullable=False,default=False)
    task_close_required=Column(Boolean,nullable=False,default=False)
    updated_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    updated_at=Column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())


class PurchaseApproval(Base):
    __tablename__="purchase_approvals"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True)
    requested_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    payload=Column(JSON,nullable=False)
    fingerprint=Column(String(64),nullable=False)
    status=Column(String(20),nullable=False,default="pending")
    purchase_id=Column(Integer,ForeignKey("inventory_purchases.id"),nullable=True,unique=True)
    reviewed_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    reviewed_at=Column(DateTime(timezone=True),nullable=True)
    note=Column(Text,nullable=False,default="")
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
    budget_link=relationship("PurchaseBudgetLink",uselist=False,back_populates="approval")


class TaskCloseApproval(Base):
    __tablename__="task_close_approvals"
    task_id=Column(Integer,ForeignKey("task_items.id",ondelete="CASCADE"),primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),nullable=False,index=True)
    fingerprint=Column(String(64),nullable=False)
    status=Column(String(20),nullable=False,default="pending")
    requested_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    requested_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
    reviewed_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    reviewed_at=Column(DateTime(timezone=True),nullable=True)
    note=Column(Text,nullable=False,default="")


class PurchaseBudgetLink(Base):
    __tablename__="purchase_budget_links"
    __table_args__=(CheckConstraint("active_request_id IS NULL OR active_request_id = request_id",name="ck_purchase_budget_active_request"),)
    approval_id=Column(Integer,ForeignKey("purchase_approvals.id",ondelete="CASCADE"),primary_key=True)
    request_id=Column(Integer,ForeignKey("internal_requests.id"),nullable=False,index=True)
    active_request_id=Column(Integer,ForeignKey("internal_requests.id"),nullable=True,unique=True)
    approval=relationship("PurchaseApproval",back_populates="budget_link")
    request=relationship("InternalRequest",foreign_keys=[request_id],back_populates="purchase_links")
