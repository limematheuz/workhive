from app.models.resource_log import Vehicle,VehicleJourney,ResourceCustody
from app.models.location_equipment import LocationEquipment
from app.models.staff_employee import StaffEmployee


def vehicles(db,company):
    return db.query(Vehicle).filter_by(company_id=company)


def journeys(db,company):
    return db.query(VehicleJourney).join(Vehicle).filter(Vehicle.company_id==company)


def custody(db,company):
    return db.query(ResourceCustody).join(LocationEquipment).filter(LocationEquipment.company_id==company)


def equipment(db,company,equipment_id):
    return db.query(LocationEquipment).filter_by(company_id=company,id=equipment_id,is_active=True).with_for_update().first()


def person(db,company,person_id):
    return db.query(StaffEmployee).filter_by(company_id=company,id=person_id).first()


def unreturned(db,equipment_id):
    return db.query(ResourceCustody).filter_by(equipment_id=equipment_id,returned_at=None).count()
