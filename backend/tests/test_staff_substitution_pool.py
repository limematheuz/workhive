from datetime import datetime, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo
import pytest
from pydantic import ValidationError
from app.models.staff_employee import StaffEmployee
from app.schemas.staff import Profile
from app.services.staff_availability_policy import covers_weekly, eligibility_issues
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location


def _profile(location, *, state="Activo", expires="2027-12-31"):
    return {"state":state,"availability":"Texto legado que se conserva", "compatible_location_ids":[location],
        "weekly_availability":[{"weekday":4,"starts_at":"08:00","ends_at":"16:00"}],
        "documents":[{"name":"Curso", "url":"https://example.test/course.pdf", "document_type":"training", "qualification_code":"chemical_handling", "issued_on":"2020-01-01", "expires_on":expires}]}


def _setup(client, db):
    company = _company(db,"substitution-pool")
    admin = _bootstrap_admin(db,company,"pool-admin")
    headers = _headers(admin)
    site = _location(client,headers,_client(client,headers)["id"])
    people=[]
    for name, profile in [("Ausente",{}),("Disponible",_profile(site["id"])),("Baja",_profile(site["id"],state="Baja")),("Caducada",_profile(site["id"],expires="2026-01-01")),("Solo texto",{"availability":"Viernes de 8 a 16"})]:
        person=StaffEmployee(company_id=company.id,name=name,position="Limpieza",team="Norte",monthly_hours=160,hourly_cost=15,profile=profile)
        db.add(person);people.append(person)
    db.commit()
    shift=client.post("/api/v1/staff-shifts",headers=headers,json={"employee_id":people[0].id,"location_id":site["id"],"starts_at":"2026-11-20T08:00:00Z","ends_at":"2026-11-20T10:00:00Z"})
    assert shift.status_code==201,shift.text
    absence=client.post("/api/v1/staff-absences",headers=headers,json={"employee_id":people[0].id,"substitute_id":None,"starts_on":"2026-11-20","ends_on":"2026-11-20","kind":"Ausencia"})
    assert absence.status_code==201,absence.text
    query={"absence_id":absence.json()["id"],"location_id":site["id"],"starts_at":"2026-11-20T08:00:00Z","ends_at":"2026-11-20T10:00:00Z","required_training_codes":["chemical_handling"]}
    return company,admin,headers,site,people,query


def test_weekly_slots_validate_structure_and_preserve_legacy_text():
    profile=Profile(availability="Por las mañanas")
    assert profile.availability=="Por las mañanas" and profile.weekly_availability is None
    for slots in [[{"weekday":7,"starts_at":"08:00","ends_at":"16:00"}], [{"weekday":0,"starts_at":"16:00","ends_at":"08:00"}], [{"weekday":0,"starts_at":"08:00","ends_at":"12:00"},{"weekday":0,"starts_at":"11:00","ends_at":"15:00"}]]:
        with pytest.raises(ValidationError):Profile(weekly_availability=slots)
    with pytest.raises(ValidationError):Profile(compatible_location_ids=[1,1])
    with pytest.raises(ValidationError):Profile(documents=[{"name":"Curso","url":"https://example.test/x","document_type":"training","issued_on":"2026-02-01","expires_on":"2026-01-01"}])


def test_weekly_coverage_handles_adjacent_slots_midnight_and_daylight_saving():
    zone=ZoneInfo("Europe/Madrid")
    stamp=lambda value:datetime.fromisoformat(value)
    slots=[{"weekday":4,"starts_at":"08:00","ends_at":"12:00"},{"weekday":4,"starts_at":"12:00","ends_at":"16:00"}]
    assert covers_weekly(slots,stamp("2026-11-20T07:00:00+00:00"),stamp("2026-11-20T15:00:00+00:00"),zone)
    slots[1]["starts_at"]="12:30"
    assert not covers_weekly(slots,stamp("2026-11-20T07:00:00+00:00"),stamp("2026-11-20T15:00:00+00:00"),zone)
    overnight=[{"weekday":4,"starts_at":"22:00","ends_at":"24:00"},{"weekday":5,"starts_at":"00:00","ends_at":"02:00"}]
    assert covers_weekly(overnight,stamp("2026-11-20T21:00:00+00:00"),stamp("2026-11-21T01:00:00+00:00"),zone)
    assert covers_weekly([{"weekday":6,"starts_at":"02:00","ends_at":"04:00"}],stamp("2026-10-25T00:00:00+00:00"),stamp("2026-10-25T02:00:00+00:00"),zone)


def test_search_and_assignment_validate_real_data_and_keep_baja_visible(client, db):
    _,_,headers,_,people,query=_setup(client,db)
    found=client.post("/api/v1/staff-absences/candidates/search",headers=headers,json=query)
    assert found.status_code==200,found.text
    rows={row["name"]:row for row in found.json()["items"]}
    assert rows["Disponible"]["eligible"]
    for name in ("Baja","Caducada","Solo texto","Ausente"):assert not rows[name]["eligible"]
    denied=client.post("/api/v1/staff-absences/candidates/assign",headers=headers,json={**query,"employee_id":people[2].id})
    assert denied.status_code==409,denied.text
    assigned=client.post("/api/v1/staff-absences/candidates/assign",headers=headers,json={**query,"employee_id":people[1].id})
    assert assigned.status_code==200,assigned.text
    shifts=client.get("/api/v1/staff-shifts",headers=headers).json()
    assert shifts[0]["effective_employee_id"]==people[1].id


def test_assignment_rechecks_changes_after_search_and_refuses_overlaps(client, db):
    _,_,headers,site,people,query=_setup(client,db)
    busy=client.post("/api/v1/staff-shifts",headers=headers,json={"employee_id":people[1].id,"location_id":site["id"],"starts_at":query["starts_at"],"ends_at":query["ends_at"]})
    assert busy.status_code==201,busy.text
    response=client.post("/api/v1/staff-absences/candidates/assign",headers=headers,json={**query,"employee_id":people[1].id})
    assert response.status_code==409,response.text
    records=client.get("/api/v1/staff-absences",headers=headers).json()
    assert records[0]["substitute_id"] is None


def test_scope_dates_and_cross_company_identifiers_fail_closed(client, db):
    _,_,headers,_,people,query=_setup(client,db)
    other=_company(db,"pool-other")
    outsider=_bootstrap_admin(db,other,"pool-outsider")
    assert client.post("/api/v1/staff-absences/candidates/search",headers=_headers(outsider),json=query).status_code in (403,404)
    assert client.post("/api/v1/staff-absences/candidates/assign",headers=headers,json={**query,"employee_id":999999}).status_code==404
    assert client.post("/api/v1/staff-absences/candidates/search",headers=headers,json={**query,"starts_at":"2026-11-19T08:00:00Z","ends_at":"2026-11-19T10:00:00Z"}).status_code==422
    assert client.post("/api/v1/staff-absences/candidates/search",headers=headers,json={**query,"required_training_codes":["invented"]}).status_code==422


def test_profile_eligibility_checks_every_required_certificate_and_location():
    worker=SimpleNamespace(profile=_profile(10),name="Ana")
    start=datetime(2026,11,20,8,tzinfo=timezone.utc);end=datetime(2026,11,20,10,tzinfo=timezone.utc)
    zone=ZoneInfo("Europe/Madrid")
    assert not eligibility_issues(worker,10,start,end,zone,["chemical_handling"],strict=True)
    assert eligibility_issues(worker,11,start,end,zone,[],strict=True)
    assert eligibility_issues(worker,10,start,end,zone,["height_work"],strict=True)
