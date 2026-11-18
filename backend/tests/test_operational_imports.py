from datetime import datetime,timedelta,timezone
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.client import Client
from app.services.organization_bootstrap_service import ensure_user_membership
from tests.test_inventory_purchase_flow import _inventory_company
from tests.test_location_workspace import _admin,_headers

def setup(db,suffix):
    company=_inventory_company(db,suffix);owner=_admin(db,company);ensure_user_membership(db,owner);db.commit();return company,owner,_headers(owner)

def test_center_excel_preview_executes_canonical_rows_and_deduplicates(client,db):
    company,owner,headers=setup(db,"import-site")
    response=client.post("/api/v1/data-import/preview?kind=locations",headers=headers,files={"file":("centros.csv","nombre;dirección;ciudad\nCentro Uno;Calle Prueba 1;Barcelona\n".encode(),"text/csv")})
    assert response.status_code==200,response.text
    rows=response.json();assert rows[0]["name"]=="Centro Uno"
    for repeat in range(2):
        result=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"locations","records":rows});assert result.status_code==200,result.text
        assert result.json()["already_imported"] is bool(repeat)
    assert db.query(Location).count()==1 and db.query(Location).one().is_temporary is False

def test_work_import_creates_jobs_without_centers_or_spaces_and_is_atomic(client,db):
    company,owner,headers=setup(db,"import-jobs")
    at=(datetime.now(timezone.utc)+timedelta(days=5)).isoformat()
    rows=[dict(title="Limpieza importada",address="Calle Prueba 2",city="Girona",scheduled_start_at=at,duration_minutes="90",tasks="Superficies|Suelo")]
    result=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"work","records":rows});assert result.status_code==200,result.text
    repeated=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"work","records":rows});assert repeated.status_code==200 and repeated.json()["already_imported"]
    task=db.get(TaskItem,result.json()["ids"][0]);assert len(task.checklist_items)==2 and not task.zones
    assert db.get(Location,task.location_id).is_temporary
    before=(db.query(Location).count(),db.query(TaskItem).count())
    invalid=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"work","records":[{**rows[0],"title":"No debe persistir"},{**rows[0],"title":"Inválido","employee_ids":[999999]}]})
    assert invalid.status_code==422,invalid.text
    assert (db.query(Location).count(),db.query(TaskItem).count())==before

def test_foreign_client_and_ambiguous_labels_are_not_imported(client,db):
    company,owner,headers=setup(db,"import-owner");other,_,_=setup(db,"import-foreign")
    foreign=Client(company_id=other.id,name="Cliente ajeno",address="Calle 1",city="Vic",postal_code="08500",country="ES");db.add(foreign);db.commit()
    result=client.post("/api/v1/data-import/execute",headers=headers,json={"kind":"locations","records":[dict(name="Centro ajeno",address="Calle 1",city="Vic",client_id=foreign.id)]})
    assert result.status_code==422,result.text
    assert db.query(Location).count()==0
