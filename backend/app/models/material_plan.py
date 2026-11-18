from sqlalchemy import Column,ForeignKey,Integer,Numeric,CheckConstraint
from app.db.session import Base


class MaterialPlan(Base):
    __tablename__="material_plans"
    __table_args__=(CheckConstraint("quantity >= 0",name="ck_material_plan_quantity"),)
    work_order_id=Column(Integer,ForeignKey("work_orders.id",ondelete="CASCADE"),primary_key=True)
    material_id=Column(Integer,ForeignKey("inventory_materials.id"),primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    quantity=Column(Numeric(14,3),nullable=False)
