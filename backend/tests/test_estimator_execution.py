from copy import deepcopy
from decimal import Decimal
from app.models.task_item import TaskItem
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers
from test_service_estimator import setup,preview,create


def accepted_scope(client,db):
    company,_,headers,_,site,spaces,person,body=setup(client,db,"quoted-execution",minutes=60,rate=15)
    body["occurrences"]=2
    calculated=preview(client,headers,body)
    saved=create(client,headers,body,calculated)
    assert saved.status_code==201,saved.text
    quote=saved.json()
    assert client.patch(f"/api/v1/quotes/{quote['quote_id']}",headers=headers,json={"status":"sent"}).status_code==200
    accepted=client.post(f"/api/v1/quotes/{quote['quote_id']}/accept",headers=headers,json={"register_client":False})
    assert accepted.status_code==200,accepted.text
    contract=client.get("/api/v1/service-contracts/",headers=headers).json()[0]
    covered=client.post(f"/api/v1/service-contracts/{contract['id']}/locations",headers=headers,json={"location_ids":[site["id"]]})
    assert covered.status_code==200,covered.text
    active=client.post(f"/api/v1/service-contracts/{contract['id']}/activate",headers=headers)
    assert active.status_code==200,active.text
    return company,headers,site,spaces,person,body,contract,calculated


def test_accepted_calculator_quote_prices_each_matching_visit_and_caps_total(client,db):
    company,headers,site,spaces,person,body,contract,calculated=accepted_scope(client,db)
    scope=client.get(f"/api/v1/service-planning/contract-scope?contract_id={contract['id']}&location_id={site['id']}",headers=headers)
    assert scope.status_code==200,scope.text
    assert scope.json()["occurrences"]==2 and scope.json()["remaining_occurrences"]==2
    assert scope.json()["spaces"][0]["space_id"]==spaces[0]["id"]
    payload={"work_order":{"title":"Visitas contratadas","location_id":site["id"],"service_contract_id":contract["id"],"status":"active","order_type":"recurring","recurrence_unit":"weekly","recurrence_interval":1,"scheduled_start_at":"2026-12-10T08:00:00Z"},"spaces":body["spaces"]}
    created=client.post("/api/v1/service-planning",headers=headers,json=payload)
    assert created.status_code==201,created.text
    first=db.get(TaskItem,created.json()["task_id"])
    assert Decimal(str(first.price))==Decimal(calculated["suggested_unit_price"])
    assert first.quantity==1 and first.unit=="service" and first.pricing_mode=="fixed"
    assert len(first.zones)==1 and first.zones[0].zone_id==spaces[0]["id"]
    order=created.json()["work_order"]["id"]
    second=client.post(f"/api/v1/work-orders/{order}/generate",headers=headers)
    assert second.status_code==200,second.text
    task=db.get(TaskItem,second.json()["task_item_id"]);assert task.price==first.price and task.quantity==1
    third=client.post(f"/api/v1/work-orders/{order}/generate",headers=headers)
    assert third.status_code==409,third.text
    assert db.query(TaskItem).filter(TaskItem.company_id==company.id).count()==2
    remaining=client.get(f"/api/v1/service-planning/contract-scope?contract_id={contract['id']}&location_id={site['id']}",headers=headers).json()
    assert remaining["remaining_occurrences"]==0
    mismatched=deepcopy(payload);mismatched["work_order"]["order_type"]="one_off";mismatched["work_order"].pop("recurrence_unit");mismatched["work_order"].pop("recurrence_interval")
    mismatched["work_order"]["scheduled_start_at"]="2026-12-11T08:00:00Z"
    mismatched["spaces"]=[{"space_id":spaces[1]["id"],"task_ids":[spaces[1]["tasks"][0]["id"]],"employee_ids":[person.id]}]
    unpriced=client.post("/api/v1/service-planning",headers=headers,json=mismatched)
    assert unpriced.status_code==201,unpriced.text
    assert db.get(TaskItem,unpriced.json()["task_id"]).price is None
    external=_headers(_bootstrap_admin(db,_company(db,"execution-foreign"),"execution-foreign"))
    assert client.get(f"/api/v1/service-planning/contract-scope?contract_id={contract['id']}&location_id={site['id']}",headers=external).status_code==404
    assert client.post("/api/v1/service-planning",headers=external,json=payload).status_code==404
