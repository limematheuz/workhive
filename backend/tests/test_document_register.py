from app.models.staff_account import StaffDocumentReceipt
from app.models.document_register import DocumentSignature
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers,_user
from tests.test_client_portal_api import _client,_portal_user,_grant

PDF=b"%PDF-1.4\nfirst version\n%%EOF"
SECOND=b"%PDF-1.4\nsecond private version\n%%EOF"


def setup(db,suffix="register"):
    company=_company(db,suffix);company.subscription_plan="top"
    admin=_bootstrap_admin(db,company,suffix)
    customer=_client(db,company=company,suffix=suffix);db.commit()
    return company,admin,customer,_headers(admin)


def upload(client,headers,kind,owner,contents=PDF):
    response=client.post("/api/v1/document-register",headers=headers,data={"owner_type":kind,"owner_id":owner,"title":"Acuerdo de servicio","document_type":"contract","expires_on":"2028-01-01"},files={"file":("acuerdo.pdf",contents,"application/pdf")})
    assert response.status_code==201,response.text
    return response.json()


def sign_body(row):
    return {"expected_revision":row["current"]["revision"],"expected_hash":row["current"]["revision_hash"],"signer_name":"Persona autorizada","confirmed":True}


def test_document_versions_sign_exact_content_and_keep_legacy_receipts(client,db):
    company,admin,_,headers=setup(db)
    staff=client.post("/api/v1/staff",headers=headers,json={"name":"Trabajadora","position":"Limpieza","team":"A","monthly_hours":160,"hourly_cost":15,"profile":{"account_email":admin.email}})
    assert staff.status_code==201,staff.text
    employee=staff.json()["id"]
    old=StaffDocumentReceipt(employee_id=employee,user_id=admin.id,digest="a"*64);db.add(old);db.commit()
    row=upload(client,headers,"staff",employee)
    path=f"/api/v1/document-register/{row['id']}/revisions/{row['current']['id']}/sign"
    bad=sign_body(row);bad["expected_hash"]="0"*64
    assert client.post(path,headers=headers,json=bad).status_code==409
    result=client.post(path,headers=headers,json=sign_body(row));assert result.status_code==200,result.text
    assert result.json()["current"]["signatures"][0]["revision_hash"]==row["current"]["revision_hash"]
    assert client.post(path,headers=headers,json=sign_body(row)).status_code==200
    assert db.query(DocumentSignature).count()==1 and db.query(StaffDocumentReceipt).count()==1
    revision=client.post(f"/api/v1/document-register/{row['id']}/revisions",headers=headers,data={"expected_revision":1,"title":"Acuerdo revisado"},files={"file":("revisado.pdf",SECOND,"application/pdf")})
    assert revision.status_code==201,revision.text
    assert revision.json()["current"]["revision"]==2 and not revision.json()["current"]["signatures"]
    assert client.post(path,headers=headers,json=sign_body(row)).status_code==409
    versions=client.get(f"/api/v1/document-register/{row['id']}/revisions",headers=headers).json()
    assert [r["revision"] for r in versions]==[2,1] and len(versions[1]["signatures"])==1
    assert client.get(row["current"]["download_url"],headers=headers).content==PDF


def test_customer_only_sees_explicit_published_revision_and_revocation_is_immediate(client,db):
    company,admin,customer,headers=setup(db,"public-register")
    user,public_headers=_portal_user(db,email="document-customer@example.test",suffix="document")
    grant=_grant(db,company=company,customer=customer,user=user,admin=admin);db.commit()
    row=upload(client,headers,"client",customer.id)
    portal=f"/api/v1/client-portal/workspaces/{grant.id}/documents"
    assert client.get(portal,headers=public_headers).json()["records"]==[]
    published=client.post(f"/api/v1/document-register/{row['id']}/publication",headers=headers,json={"revision_id":row["current"]["id"],"expected_hash":row["current"]["revision_hash"]})
    assert published.status_code==200,published.text
    revision=client.post(f"/api/v1/document-register/{row['id']}/revisions",headers=headers,data={"expected_revision":1,"title":"PRIVATE_REVISION_TITLE"},files={"file":("private.pdf",SECOND,"application/pdf")}).json()
    public=client.get(portal,headers=public_headers).json()["records"][0]
    assert public["current"]["revision"]==1
    assert "PRIVATE_REVISION_TITLE" not in str(public)
    assert client.get(public["current"]["download_url"],headers=public_headers).content==PDF
    private_url=f"{portal}/{row['id']}/revisions/{revision['current']['id']}/download"
    assert client.get(private_url,headers=public_headers).status_code==404
    signed=client.post(f"{portal}/{row['id']}/revisions/{row['current']['id']}/sign",headers=public_headers,json=sign_body(row))
    assert signed.status_code==200,signed.text
    assert "user_id" not in signed.json()["current"]["signatures"][0]
    assert client.get(row["current"]["download_url"],headers=public_headers).status_code==403
    assert client.post(f"/api/v1/document-register/{row['id']}/publication",headers=headers,json={"revision_id":None}).status_code==200
    assert client.get(public["current"]["download_url"],headers=public_headers).status_code==404
    grant.status="revoked";db.commit()
    assert client.get(portal,headers=public_headers).status_code==403


def test_document_ownership_legacy_link_and_foreign_access_fail_closed(client,db):
    company,admin,customer,headers=setup(db,"owner-register")
    row=upload(client,headers,"client",customer.id)
    other_company,other,_,foreign=setup(db,"foreign-register")
    assert client.get(row["current"]["download_url"],headers=foreign).status_code==404
    assert client.post(f"/api/v1/document-register/{row['id']}/publication",headers=foreign,json={"revision_id":None}).status_code==404
    assert client.get("/api/v1/document-register").status_code==401
    viewer=_user(db,company,"unassigned-document",3);db.commit()
    assert client.get(row["current"]["download_url"],headers=_headers(viewer)).status_code==403
    staff=client.post("/api/v1/staff",headers=headers,json={"name":"Archivo previo","position":"Limpieza","team":"A","monthly_hours":160,"hourly_cost":15}).json()
    source=client.post(f"/api/v1/staff-files/{staff['id']}",headers=headers,files={"file":("legacy.pdf",PDF,"application/pdf")})
    assert source.status_code==201,source.text
    source_id=int(source.json()["url"].split("/")[-2])
    linked=client.post("/api/v1/document-register/link",headers=headers,json={"source_type":"staff_file","source_id":source_id})
    assert linked.status_code==200,linked.text
    assert client.get(linked.json()["current"]["download_url"],headers=headers).content==PDF
    assert client.post("/api/v1/document-register/link",headers=foreign,json={"source_type":"staff_file","source_id":source_id}).status_code==404


def test_linked_worker_signs_own_file_without_hr_administration(client,db):
    company,admin,_,headers=setup(db,"own-signature")
    worker=_user(db,company,"own-worker",3);outsider=_user(db,company,"other-worker",3);db.commit()
    person=client.post("/api/v1/staff",headers=headers,json={"name":"Firmante","position":"Limpieza","team":"A","monthly_hours":160,"hourly_cost":15,"profile":{"account_email":worker.email}}).json()
    row=upload(client,headers,"staff",person["id"])
    own=_headers(worker);other=_headers(outsider)
    assert client.get(row["current"]["download_url"],headers=own).content==PDF
    assert client.get(row["current"]["download_url"],headers=other).status_code==403
    result=client.get("/api/v1/document-register",headers=own).json()
    assert [r["id"] for r in result["records"]]==[row["id"]]
    assert result["records"][0]["can_manage"] is False
    path=f"/api/v1/document-register/{row['id']}/revisions/{row['current']['id']}/sign"
    assert client.post(path,headers=other,json=sign_body(row)).status_code==403
    assert client.post(path,headers=own,json={**sign_body(row),"confirmed":False}).status_code==422
    assert client.post(path,headers=own,json=sign_body(row)).status_code==200
    assert client.post(f"/api/v1/document-register/{row['id']}/revisions",headers=own,data={"expected_revision":1},files={"file":("new.pdf",SECOND,"application/pdf")}).status_code==403


def test_document_signature_rejects_storage_tampering(client,db):
    from app.repositories import document_register as repo
    from app.services.storage_service import get_object_storage
    _,_,customer,headers=setup(db,"integrity")
    row=upload(client,headers,"client",customer.id)
    revision=repo.revision(db,row["current"]["id"])
    get_object_storage().put(revision.storage_key,SECOND,"application/pdf")
    path=f"/api/v1/document-register/{row['id']}/revisions/{revision.id}/sign"
    assert client.post(path,headers=headers,json=sign_body(row)).status_code==409
    assert client.get(row["current"]["download_url"],headers=headers).status_code==409
    assert db.query(DocumentSignature).count()==0
