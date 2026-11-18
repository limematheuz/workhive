
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location
from app.models.staff_employee import StaffEmployee
from app.models.location_equipment import LocationEquipment


def test_resource_custody_return_and_vehicle_kilometres(client,db):
    company = _company(db,"resource-log")
    user = _bootstrap_admin(db,company,"resource-log")
    headers = _headers(user)
    customer = _client(client,headers)
    site = _location(client,headers,customer["id"])
    person = StaffEmployee(company_id=company.id,name="María",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15)
    asset = LocationEquipment(company_id=company.id,location_id=site["id"],name="Llave",quantity=1,status="active",is_active=True)
    db.add_all([person,asset]);db.commit()
    base = "/api/v1/resource-log"
    delivery = dict(employee_id=person.id,equipment_id=asset.id)
    first = client.post(base+"/custody",headers=headers,json=delivery)
    assert first.status_code == 201,first.text
    assert client.post(base+"/custody",headers=headers,json=delivery).status_code == 409
    assert client.post(f"{base}/custody/{first.json()['id']}/return",headers=headers).status_code == 200
    assert client.post(base+"/custody",headers=headers,json=delivery).status_code == 201
    vehicle = client.post(base+"/vehicles",headers=headers,json={"name":"Furgoneta","registration":"TEST-001","odometer":100})
    assert vehicle.status_code == 201, vehicle.text
    trip = dict(vehicle_id=vehicle.json()["id"],employee_id=person.id,location_id=site["id"],
                starts_at="2026-11-16T08:00:00Z",ends_at="2026-11-16T09:00:00Z",start_km=100,end_km=120)
    assert client.post(base+"/journeys",headers=headers,json=trip).status_code == 201
    assert client.post(base+"/journeys",headers=headers,json=trip).status_code == 409
    other = _headers(_bootstrap_admin(db,_company(db,"resources-other"),"resources-other"))
    assert client.get(base,headers=other).json()["vehicles"] == []
    assert client.post(f"{base}/custody/{first.json()['id']}/return",headers=other).status_code == 404
