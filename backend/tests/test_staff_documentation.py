
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers


def test_staff_document_receipt_is_bound_to_linked_person_and_version(client,db):
    company=_company(db,"doc-receipt")
    owner=_bootstrap_admin(db,company,"doc-receipt")
    headers=_headers(owner)
    body=dict(name="María",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15,
        profile=dict(account_email=owner.email,documents=[dict(name="Formación",url="https://example.com/training",version="1",expires_on="2026-01-01")]))
    created=client.post("/api/v1/staff",headers=headers,json=body)
    assert created.status_code==201,created.text
    endpoint="/api/v1/staff-documentation"
    docs=client.get(endpoint+"?own=true",headers=headers).json()
    assert docs[0]["expired"] is True
    url=f"{endpoint}/{docs[0]['digest']}/acknowledge"
    assert client.post(url,headers=headers).status_code==200
    assert client.get(endpoint+"?own=true",headers=headers).json()[0]["acknowledged_at"]
    other=_headers(_bootstrap_admin(db,_company(db,"doc-other"),"doc-other"))
    assert client.post(url,headers=other).status_code==404
    body["profile"]["documents"][0]["version"]="2"
    assert client.put("/api/v1/staff/"+str(created.json()["id"]),headers=headers,json=body).status_code==200
    assert client.get(endpoint+"?own=true",headers=headers).json()[0]["acknowledged_at"] is None


def test_uploaded_staff_file_remains_private_to_its_company(client,db):
    company=_company(db,"doc-file")
    owner=_bootstrap_admin(db,company,"doc-file")
    headers=_headers(owner)
    created=client.post("/api/v1/staff",headers=headers,json=dict(name="Prueba archivo",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15))
    assert created.status_code==201
    employee=created.json()
    uploaded=client.post("/api/v1/staff-files/"+str(employee["id"]),headers=headers,
        files={"file":("prevencion.pdf",b"%PDF-1.4\n%%EOF","application/pdf")})
    assert uploaded.status_code==201,uploaded.text
    employee["profile"]["documents"]=[uploaded.json()]
    assert client.put("/api/v1/staff/"+str(employee["id"]),headers=headers,json=employee).status_code==200
    url=uploaded.json()["url"]
    assert client.get(url,headers=headers).status_code==200
    other=_headers(_bootstrap_admin(db,_company(db,"doc-file-other"),"doc-file-other"))
    assert client.get(url,headers=other).status_code==404
