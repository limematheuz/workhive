from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import event
from app.main import app
from app.api.v1.workspace_search import router
from app.models.invoice import Invoice
from app.models.location import Location
from app.models.quote import Quote
from app.models.quality_incident import QualityIncident
from app.models.staff_employee import StaffEmployee
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _bootstrap_admin, _client, _company, _headers


@pytest.fixture(scope="module", autouse=True)
def register_search_routes():
    if "/api/v1/workspace-search" not in app.openapi()["paths"]:
        app.include_router(router, prefix="/api/v1")
        app.openapi_schema = None


@pytest.fixture
def search_world(db):
    company, foreign = _company(db, "search-own"), _company(db, "search-foreign")
    company.subscription_plan = foreign.subscription_plan = "mega"
    admin = _bootstrap_admin(db, company, "search-admin")
    other = _bootstrap_admin(db, foreign, "search-other")
    account = _client(db, company, "Marina Cliente")
    foreign_account = _client(db, foreign, "Marina FOREIGN SECRET")
    site = Location(name="Marina Centro", address="Calle de la Paz 91", city="Madrid",
        owner_company_id=company.id, managing_company_id=company.id)
    outside = Location(name="Marina FOREIGN SECRET", address="Calle de la Paz 91", city="Madrid",
        owner_company_id=foreign.id, managing_company_id=foreign.id)
    db.add_all([site, outside]); db.flush()
    task = TaskItem(company_id=company.id, location_id=site.id, user_id=admin.id,
        title="Marina Limpieza", status="accepted", unit="servicio")
    foreign_task = TaskItem(company_id=foreign.id, location_id=outside.id, user_id=other.id,
        title="Marina FOREIGN SECRET", status="accepted", unit="servicio")
    employee = StaffEmployee(company_id=company.id, name="María Marina García", position="Limpieza",
        team="Marina Equipo", monthly_hours=160, hourly_cost=17,
        profile={"state":"Activo", "identifier":"PRIV-DNI-123", "gross":"9876.54"}, history={})
    now = datetime.now(timezone.utc)
    invoice = Invoice(company_id=company.id, client_id=account.id, invoice_number="FAC-MARINA-2026-001",
        issue_date=now, status="draft", base_amount=100, tax_amount=21, total_amount=121)
    quote = Quote(company_id=company.id, client_id=account.id, quote_number="PRE-MARINA-2026-001",
        title="Marina presupuesto", status="draft")
    db.add_all([task, foreign_task, employee, invoice, quote]); db.flush()
    report = TaskReport(task_item_id=task.id, reporter_user_id=admin.id, reporter_company_id=company.id,
        client_event_id="search-report-one", report_type="note", title="Marina parte", reporter_name="Report author")
    shift = WorkSession(company_id=company.id, user_id=admin.id, location_id=site.id, task_item_id=task.id,
        start_time=now-timedelta(hours=2), end_time=now-timedelta(hours=1), notes="Marina jornada")
    incident = QualityIncident(company_id=company.id, location_id=site.id, title="Marina incidencia",
        description="Necesita una revisión", status="open")
    foreign_incident = QualityIncident(company_id=foreign.id, location_id=outside.id, title="Marina FOREIGN SECRET")
    db.add_all([report, shift, incident, foreign_incident]); db.commit()
    return dict(company=company, foreign=foreign, admin=admin, other=other, account=account,
        foreign_account=foreign_account, site=site, outside=outside, task=task, foreign_task=foreign_task,
        employee=employee, invoice=invoice, quote=quote, report=report, shift=shift, incident=incident)


def search(client, user, query="Marina", kinds=None, **params):
    values = [("q",query), *[("types",kind) for kind in (kinds or [])], *params.items()]
    response = client.get("/api/v1/workspace-search", headers=_headers(user), params=values)
    assert response.status_code == 200, response.text
    return response.json()


def group(data, kind):
    return next(row for row in data["groups"] if row["type"] == kind)


def test_search_groups_real_records_with_context_and_no_private_payloads(client, search_world):
    world = search_world
    data = search(client, world["admin"])
    assert {row["type"] for row in data["groups"]} == {"clients","locations","tasks","invoices","quotes","staff","reports","time","incidents"}
    for kind, key in (("clients","account"),("locations","site"),("tasks","task"),("invoices","invoice"),
            ("quotes","quote"),("staff","employee"),("reports","report"),("time","shift"),("incidents","incident")):
        assert [row["id"] for row in group(data,kind)["items"]] == [world[key].id]
        item = group(data,kind)["items"][0]
        assert item["href"].startswith(("/dashboard", "/worker/clock"))
    assert group(data,"invoices")["items"][0]["reference"] == "FAC-MARINA-2026-001"
    assert group(data,"reports")["items"][0]["status"] is None
    assert "FOREIGN SECRET" not in str(data)
    assert "PRIV-DNI-123" not in str(data) and "9876.54" not in str(data)
    assert data["company_id"] == world["company"].id and len(data["context_key"]) == 24


def test_search_matches_addresses_accents_and_document_references(client, search_world):
    world = search_world
    assert group(search(client,world["admin"],"paz",["locations"]),"locations")["items"][0]["id"] == world["site"].id
    assert group(search(client,world["admin"],"maria",["staff"]),"staff")["items"][0]["id"] == world["employee"].id
    assert group(search(client,world["admin"],"garcia",["staff"]),"staff")["items"][0]["id"] == world["employee"].id
    assert group(search(client,world["admin"],"FAC-MARINA-2026-001",["invoices"]),"invoices")["items"][0]["id"] == world["invoice"].id


def test_search_is_database_filtered_beyond_the_first_list_page(client, db, search_world):
    world = search_world
    for index in range(110):
        _client(db, world["company"], f"Previous page {index}")
    target = _client(db, world["company"], "Needle beyond list pagination")
    data = search(client, world["admin"], "Needle", ["clients"])
    assert [row["id"] for row in group(data,"clients")["items"]] == [target.id]


def test_literal_wildcards_do_not_enumerate_all_records(client, db, search_world):
    world = search_world
    target = _client(db, world["company"], "Literal %% company")
    data = search(client, world["admin"], "%%", ["clients"])
    assert [row["id"] for row in group(data,"clients")["items"]] == [target.id]
    assert group(search(client, world["admin"], "__", ["clients"]),"clients")["items"] == []
    assert group(search(client, world["admin"], "%' OR 1=1 --", ["clients"]),"clients")["items"] == []


def test_result_limit_has_more_and_query_count_do_not_grow_per_match(client, db, search_world):
    world = search_world
    headers = _headers(world["admin"])
    def count():
        queries=[]
        def record(connection,cursor,statement,parameters,context,many):
            if statement.lstrip().upper().startswith("SELECT"):
                queries.append(statement)
        engine=db.get_bind();event.listen(engine,"before_cursor_execute",record)
        try:
            result=client.get("/api/v1/workspace-search",headers=headers,params={"q":"Marina"})
        finally:
            event.remove(engine,"before_cursor_execute",record)
        assert result.status_code==200,result.text
        return len(queries),result.json()
    before,_=count()
    for index in range(30):
        _client(db,world["company"],f"Marina many matches {index}")
    after,data=count()
    assert len(group(data,"clients")["items"])==5 and group(data,"clients")["has_more"] is True
    assert after <= before+1
    assert all(len(row["items"])<=5 for row in data["groups"])


@pytest.mark.parametrize("query,href",[("fichaje","/worker/clock"),("jornada","/worker/clock"),("parte","/dashboard/task-reports")])
def test_familiar_terms_open_permitted_sections(client,search_world,query,href):
    data=search(client,search_world["admin"],query)
    assert href in {row["href"] for row in data["navigation"]}


@pytest.mark.parametrize("params",[{"q":"x"},{"q":"x"*121},{"q":"  "},{"q":"Marina","limit_per_type":6},{"q":"Marina","types":"secret"}])
def test_search_validates_text_types_and_hard_limits(client,search_world,params):
    response=client.get("/api/v1/workspace-search",headers=_headers(search_world["admin"]),params=params)
    assert response.status_code==422
