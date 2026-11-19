from app.models.subcontract import Subcontract
from app.models.work_order import WorkOrder
from app.models.inventory import InventorySupplier


def rows(db,company,locations):
    query=db.query(Subcontract,WorkOrder,InventorySupplier).join(WorkOrder,Subcontract.work_order_id==WorkOrder.id).join(
        InventorySupplier,Subcontract.supplier_id==InventorySupplier.id).filter(Subcontract.company_id==company,
            WorkOrder.company_id==company,InventorySupplier.company_id==company)
    return query if locations is None else query.filter(WorkOrder.location_id.in_(locations))
