from app.services.work_order_execution_policy import accepts_execution_costs
from app.services.entitlement_service import require_company_feature
from decimal import Decimal
from fastapi import HTTPException
from app.models.material_plan import MaterialPlan
from app.repositories import material_plan as repo,inventory as inventory_repo
from app.services import work_order_inventory_service as consumption


def read(db,user,order):
    movements=consumption.list_consumptions(db,user,order)
    company=user.company_id
    require_company_feature(db,company_id=company,code="features.inventory")
    entries={p.material_id:dict(material_id=p.material_id,name=name,unit=unit,planned=p.quantity,used=Decimal("0"))
             for p,name,unit in repo.rows(db,company,order)}
    for movement in movements:
        row=entries.setdefault(movement.material_id,dict(material_id=movement.material_id,name=movement.material_name,
                    unit="",planned=None,used=Decimal("0")))
        row["used"]+=movement.quantity*(1 if movement.movement_type=="issue" else -1)
    return list(entries.values())


def save(db,user,order,payload):
    company=consumption._company_id(db,user,inventory="inventory.manage",work="work.manage")
    require_company_feature(db,company_id=company,code="features.inventory")
    work_order=consumption._work_order_or_404(db,user,company_id=company,work_order_id=order,permission_code="work.manage")
    if work_order.status!="draft" and not accepts_execution_costs(db,work_order):raise HTTPException(409,"La orden ya está cerrada.")
    material=inventory_repo.get_material(db,company_id=company,material_id=payload.material_id)
    if material is None:raise HTTPException(404,"Material no encontrado")
    row=repo.row(db,company,order,material.id)
    if row is None:row=MaterialPlan(company_id=company,work_order_id=order,material_id=material.id);db.add(row)
    row.quantity=payload.quantity
    db.commit()
    return read(db,user,order)
