from datetime import datetime,timezone
from fastapi import HTTPException
from app.models.resource_log import Vehicle,VehicleJourney,ResourceCustody
from app.repositories import resource_log as repo
from app.services.organization_authorization_service import require_capability
from app.services.location_access_service import require_location_capability
from app.services.user_scope import require_company_context


def scope(db,user,permission):
    company = require_company_context(user)
    require_capability(db,user,permission)
    return company


def fields(row,keys):
    return {key:getattr(row,key) for key in keys.split()}


def overview(db,user):
    company = scope(db,user,"inventory.read")
    from app.repositories.staff import list_staff
    return dict(staff=[dict(id=p.id,name=p.name) for p in list_staff(db,company)],vehicles=[fields(r,"id name registration odometer service_due_on status") for r in repo.vehicles(db,company)],
                journeys=[fields(r,"id vehicle_id employee_id location_id starts_at ends_at start_km end_km notes") for r in repo.journeys(db,company).order_by(VehicleJourney.id.desc())],
                custody=[fields(r,"id equipment_id employee_id delivered_at returned_at notes") for r in repo.custody(db,company).order_by(ResourceCustody.id.desc())])


def vehicle(db,user,payload,record_id=None):
    company = scope(db,user,"inventory.manage")
    row = Vehicle(company_id=company) if record_id is None else repo.vehicles(db,company).filter_by(id=record_id).with_for_update().first()
    if row is None:
        raise HTTPException(404,"Vehículo no encontrado")
    if record_id and payload.odometer<row.odometer:
        raise HTTPException(409,"El kilometraje debe conservar el recorrido registrado.")
    for key,value in payload.model_dump().items():
        setattr(row,key,value)
    db.add(row);db.commit()
    return {"id":row.id}


def require_person(db,company,person_id):
    person = repo.person(db,company,person_id)
    if person is None or (person.profile or {}).get("state")=="Baja":
        raise HTTPException(422,"Selecciona un trabajador activo.")


def journey(db,user,payload):
    company = scope(db,user,"inventory.manage")
    require_person(db,company,payload.employee_id)
    require_location_capability(db,user,payload.location_id,"can_manage_tasks",permission_code="work.manage")
    vehicle = repo.vehicles(db,company).filter_by(id=payload.vehicle_id).with_for_update().first()
    if not vehicle or vehicle.status!="active":
        raise HTTPException(409,"Selecciona un vehículo disponible.")
    overlap = repo.journeys(db,company).filter(VehicleJourney.vehicle_id==vehicle.id,
        VehicleJourney.starts_at<payload.ends_at,VehicleJourney.ends_at>payload.starts_at).first()
    if overlap or payload.start_km<vehicle.odometer:
        raise HTTPException(409,"Revisa el trayecto solapado o el kilometraje anterior.")
    row = VehicleJourney(**payload.model_dump())
    vehicle.odometer = payload.end_km
    db.add(row);db.commit()
    return {"id":row.id}


def deliver(db,user,payload):
    company = scope(db,user,"inventory.manage")
    require_person(db,company,payload.employee_id)
    equipment = repo.equipment(db,company,payload.equipment_id)
    if not equipment or equipment.status!="active":
        raise HTTPException(404,"Material disponible no encontrado")
    require_location_capability(db,user,equipment.location_id,"can_manage_location",permission_code="locations.manage")
    if repo.unreturned(db,equipment.id)>=equipment.quantity:
        raise HTTPException(409,"Todas las unidades están entregadas. Registra una devolución.")
    row = ResourceCustody(delivered_by=user.id,**payload.model_dump())
    db.add(row);db.commit()
    return {"id":row.id}


def give_back(db,user,record_id):
    company = scope(db,user,"inventory.manage")
    row = repo.custody(db,company).filter(ResourceCustody.id==record_id).with_for_update().first()
    if not row:
        raise HTTPException(404,"Entrega no encontrada")
    equipment = repo.equipment(db,company,row.equipment_id)
    require_location_capability(db,user,equipment.location_id,"can_manage_location",permission_code="locations.manage")
    if row.returned_at is None:
        row.returned_at,row.returned_to = datetime.now(timezone.utc),user.id
        db.commit()
    return {"ok":True}
