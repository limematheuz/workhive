from datetime import date
from decimal import Decimal
from app.repositories.staff_account import historical_hourly_cost
from tests.test_client_permission_authorization import _bootstrap_admin,_company,_headers


def test_hourly_import_keeps_cost_history_without_monthly_breakdown(client,db):
    company=_company(db,"hourly-reference");admin=_bootstrap_admin(db,company,"hourly-reference")
    body=dict(name="Personal importado",position="Limpieza",team="Equipo de prueba",monthly_hours=160,hourly_cost=15,profile=dict(account_email=admin.email))
    created=client.post("/api/v1/staff",headers=_headers(admin),json=body)
    assert created.status_code==201,created.text
    period=created.json()["history"][date.today().isoformat()[:7]]
    assert period["source"]=="hourly" and Decimal(period["cost"])==Decimal(2400)
    assert historical_hourly_cost(db,company.id,admin.id,date.today())==Decimal(15)
    body["profile"]["gross"]=3200
    body["hourly_cost"]=20
    saved=client.put(f"/api/v1/staff/{created.json()['id']}",headers=_headers(admin),json=body)
    assert saved.status_code==200,saved.text
    assert saved.json()["history"][date.today().isoformat()[:7]]["source"]=="monthly"
    assert historical_hourly_cost(db,company.id,admin.id,date.today())==Decimal(20)
