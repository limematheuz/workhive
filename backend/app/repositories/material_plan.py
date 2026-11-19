from app.models.material_plan import MaterialPlan
from app.models.inventory import InventoryMaterial


def rows(db,company,order):
    return db.query(MaterialPlan,InventoryMaterial.name,InventoryMaterial.unit).join(InventoryMaterial).filter(
        MaterialPlan.company_id==company,MaterialPlan.work_order_id==order).all()


def row(db,company,order,material):
    return db.query(MaterialPlan).filter_by(company_id=company,work_order_id=order,material_id=material).first()
