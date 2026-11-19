from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import event
from app.models.location import Location
from app.models.quality_incident import QualityIncident
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.task_structure import TaskAssignment
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _assign_company_profile, _headers, _user
from tests.test_workspace_search import register_search_routes, search_world, search, group
from tests.test_application_context_boundaries import application_world, _switch


def test_search_does_not_accept_a_company_selector(client, search_world):
    world=search_world
    data=search(client,world["admin"],"FOREIGN SECRET",company_id=world["foreign"].id)
    assert data["company_id"]==world["company"].id
    assert all(not row["items"] for row in data["groups"])


@pytest.mark.parametrize("permission,expected",[("finance.read",{"invoices","quotes"}),("quality.incidents.read",{"incidents"})])
def test_readers_skip_unauthorized_record_queries_instead_of_triggering_403s(client,db,search_world,permission,expected):
    world=search_world
    reader=_user(db,world["company"],permission.replace(".","-"),role_id=3)
    _assign_company_profile(db,company=world["company"],admin=world["admin"],user=reader,
        name="Search restricted reader",permission_codes={permission})
    statements=[]
    def capture(connection,cursor,statement,parameters,context,many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement.lower())
    headers=_headers(reader);engine=db.get_bind();event.listen(engine,"before_cursor_execute",capture)
    try:
        response=client.get("/api/v1/workspace-search",headers=headers,params={"q":"Marina"})
    finally:
        event.remove(engine,"before_cursor_execute",capture)
    assert response.status_code==200,response.text
    data=response.json()
    assert set(data["available_types"])==expected
    assert {row["type"] for row in data["groups"]}==expected
    if permission == "quality.incidents.read":
        assert [row["id"] for row in group(data,"incidents")["items"]] == [world["incident"].id]
    for table in ("task_items","task_reports","staff_employees"):
        assert not any("from "+table in statement for statement in statements)
    assert client.get(f"/api/v1/staff/{world['employee'].id}",headers=headers).status_code==403


def test_incident_reader_is_scoped_to_its_authorized_location_before_limit(client, db, search_world):
    world = search_world
    reader = _user(db, world["company"], "search-quality-location", role_id=3)
    _assign_company_profile(db, company=world["company"], admin=world["admin"], user=reader,
        name="Incidents in one location", permission_codes={"quality.incidents.read"},
        scope_type="location", scope_id=world["site"].id)
    for index in range(8):
        db.add(QualityIncident(company_id=world["company"].id, location_id=world["outside"].id,
            title=f"Marina inaccessible {index}"))
    db.commit()
    data = search(client, reader, "Marina", ["incidents", "reports"])
    assert data["available_types"] == ["incidents"]
    assert [row["id"] for row in group(data,"incidents")["items"]] == [world["incident"].id]
    assert group(data,"incidents")["has_more"] is False
    navigation = search(client, reader, "incidencia")["navigation"]
    assert [row["href"] for row in navigation] == ["/dashboard/quality?tab=incidents"]


def test_inspection_navigation_uses_its_own_read_capability(client, db, search_world):
    world = search_world
    reader = _user(db, world["company"], "search-inspection-reader", role_id=3)
    _assign_company_profile(db, company=world["company"], admin=world["admin"], user=reader,
        name="Inspection reader", permission_codes={"quality.inspections.read"})
    data = search(client, reader, "inspección")
    assert data["available_types"] == [] and data["groups"] == []
    assert [row["href"] for row in data["navigation"]] == ["/dashboard/quality?tab=inspections"]
    assert search(client, reader, "incidencia")["navigation"] == []


def test_legacy_worker_task_and_report_assignments_are_filtered_in_sql_before_limit(client,db,search_world):
    world=search_world
    worker=_user(db,world["company"],"search-worker",role_id=3)
    own=TaskItem(company_id=world["company"].id,location_id=world["site"].id,user_id=worker.id,
        title="Marina worker own",status="accepted",unit="servicio")
    structured=TaskItem(company_id=world["company"].id,location_id=world["site"].id,user_id=world["admin"].id,
        title="Marina structured own",status="accepted",unit="servicio")
    db.add_all([own,structured]);db.flush()
    db.add(TaskAssignment(task_id=structured.id,user_id=worker.id,status="accepted",source="all"))
    for index in range(12):
        db.add(TaskItem(company_id=world["company"].id,location_id=world["site"].id,user_id=world["admin"].id,
            title=f"Marina unauthorized newer {index}",status="accepted",unit="servicio"))
    report=TaskReport(task_item_id=own.id,reporter_user_id=worker.id,reporter_company_id=world["company"].id,
        client_event_id="own-search-report",report_type="note",title="Marina own report",reporter_name="Worker")
    misleading=TaskReport(task_item_id=world["task"].id,reporter_user_id=worker.id,reporter_company_id=world["company"].id,
        client_event_id="unassigned-search-report",report_type="note",title="Marina no current assignment",reporter_name="Worker")
    db.add_all([report,misleading]);db.commit()
    data=search(client,worker,"Marina",["tasks","reports"],limit_per_type=5)
    assert {row["id"] for row in group(data,"tasks")["items"]}=={own.id,structured.id}
    assert [row["id"] for row in group(data,"reports")["items"]]==[report.id]
    db.query(TaskAssignment).filter_by(task_id=structured.id,user_id=worker.id).update({"user_id":world["admin"].id})
    own.user_id=world["admin"].id;db.commit()
    removed=search(client,worker,"Marina",["tasks","reports"])
    assert group(removed,"tasks")["items"]==[] and group(removed,"reports")["items"]==[]


def test_location_profile_cannot_search_sibling_location_even_with_exact_text(client,db,search_world):
    world=search_world
    reader=_user(db,world["company"],"search-location-reader",role_id=2)
    _assign_company_profile(db,company=world["company"],admin=world["admin"],user=reader,
        name="Only the assigned site",permission_codes={"locations.read","work.read"},scope_type="location",scope_id=world["site"].id)
    hidden=Location(name="Marina hidden scope",address="Marina hidden address",city="Madrid",
        owner_company_id=world["company"].id,managing_company_id=world["company"].id)
    db.add(hidden);db.flush()
    blocked=TaskItem(company_id=world["company"].id,location_id=hidden.id,title="Marina hidden task",
        status="accepted",unit="servicio",user_id=reader.id)
    db.add(blocked);db.commit()
    data=search(client,reader,"Marina",["locations","tasks"])
    assert [row["id"] for row in group(data,"locations")["items"]]==[world["site"].id]
    assert [row["id"] for row in group(data,"tasks")["items"]]==[world["task"].id]


@pytest.mark.parametrize("kind",["client","adviser"])
def test_portal_context_cannot_recover_internal_search_privileges(client,db,application_world,kind):
    world=application_world
    _,headers=_switch(client,world["person"],kind)
    response=client.get("/api/v1/workspace-search",headers=headers,params={"q":"Application"})
    assert response.status_code==403
    db.refresh(world["person"])
    assert world["person"].role.name=="admin" and world["person"].company_id==world["first"].id


def test_platform_and_unassigned_internal_accounts_cannot_search_every_company(client,db,search_world):
    platform=_user(db,None,"search-platform",role_id=4)
    unassigned=_user(db,None,"search-unassigned",role_id=1)
    db.commit()
    for person in (platform,unassigned):
        response=client.get("/api/v1/workspace-search",headers=_headers(person),params={"q":"Marina"})
        assert response.status_code==403
    assert client.get("/api/v1/workspace-search",params={"q":"Marina"}).status_code==401


def test_staff_detail_uses_an_exact_authorized_company_lookup(client,search_world):
    world=search_world
    response=client.get(f"/api/v1/staff/{world['employee'].id}",headers=_headers(world["admin"]))
    assert response.status_code==200,response.text
    assert response.json()["id"]==world["employee"].id
    assert client.get(f"/api/v1/staff/{world['employee'].id}",headers=_headers(world["other"])).status_code==404


def test_clock_results_are_own_records_in_the_active_company_only(client, db, search_world):
    world = search_world
    now = datetime.now(timezone.utc)
    for user_id, company_id in ((world["other"].id, world["company"].id),
            (world["admin"].id, world["foreign"].id)):
        db.add(WorkSession(company_id=company_id, user_id=user_id, location_id=world["site"].id,
            start_time=now-timedelta(hours=4), end_time=now-timedelta(hours=3), notes="Marina private shift"))
    db.commit()
    data = search(client, world["admin"], "Marina", ["time"])
    assert [row["id"] for row in group(data,"time")["items"]] == [world["shift"].id]


def test_disallowed_or_omitted_types_never_read_business_tables(client, db, search_world):
    statements = []
    def capture(connection, cursor, statement, parameters, context, many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement.lower())
    engine = db.get_bind()
    headers = _headers(search_world["admin"])
    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.get("/api/v1/workspace-search", headers=headers,
            params={"q":"Marina", "types":"clients"})
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert response.status_code == 200, response.text
    business = [statement for statement in statements if "from clients " in statement]
    assert len(business) == 1 and "limit" in business[0] and "clients.company_id =" in business[0]
    for table in ("task_items", "task_reports", "staff_employees", "invoices", "quotes", "quality_incidents"):
        assert not any("from " + table + " " in statement for statement in statements)
