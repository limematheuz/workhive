from sqlalchemy import Column,Integer,ForeignKey,CheckConstraint
from app.db.session import Base


class CompanyHierarchy(Base):
    __tablename__="company_hierarchy"
    __table_args__=(CheckConstraint("company_id != parent_company_id",name="ck_company_hierarchy_parent"),)
    company_id=Column(Integer,ForeignKey("companies.id",ondelete="CASCADE"),primary_key=True)
    parent_company_id=Column(Integer,ForeignKey("companies.id",ondelete="RESTRICT"),nullable=False,index=True)
