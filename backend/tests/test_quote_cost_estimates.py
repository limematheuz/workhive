from decimal import Decimal
from app.models.margin_forecast import MarginForecast
from tests.test_client_permission_authorization import _bootstrap_admin,_company,_headers
from test_service_contracts import _client


def test_quote_cost_budget_is_transferred_once_and_closed(client,db):
    company=_company(db,"cost-simulation")
    headers=_headers(_bootstrap_admin(db,company,"cost-simulation"))
    customer=_client(client,headers)
    response=client.post("/api/v1/quotes/",headers=headers,json={"client_id":customer["id"],"title":"Coste previsto","items":[{"description":"Servicio","quantity":1,"unit_price":330}]})
    assert response.status_code==201,response.text
    quote=response.json()
    url=f"/api/v1/quote-cost-estimates/{quote['id']}"
    body={"revision":quote["revision_number"],"labor_hours":"4","hourly_cost":"15","materials":"20","other_costs":"10"}
    saved=client.put(url,headers=headers,json=body)
    assert saved.status_code==200,saved.text
    assert Decimal(str(saved.json()["cost"]))==90
    assert Decimal(str(saved.json()["margin"]))==240
    assert client.put(url,headers=headers,json={**body,"revision":99}).status_code==409
    assert client.patch(f"/api/v1/quotes/{quote['id']}",headers=headers,json={"status":"sent"}).status_code==200
    accepted=client.post(f"/api/v1/quotes/{quote['id']}/accept",headers=headers,json={"register_client":False})
    assert accepted.status_code==200,accepted.text
    budgets=db.query(MarginForecast).all()
    assert len(budgets)==1 and budgets[0].planned_direct_cost_amount==90
    assert client.put(url,headers=headers,json=body).status_code==409
    other=_headers(_bootstrap_admin(db,_company(db,"cost-other"),"cost-other"))
    assert client.get(url,headers=other).status_code==404
