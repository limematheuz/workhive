"""Personal privacy operations survive tenant revocation without tenant grants."""

import pytest

from app.models.company_membership import CompanyMembership
from app.models.user import User
from tests.test_user_invitations import _register_company
from credentials import login_form


@pytest.mark.parametrize("status",["archived","suspended"])
def test_identity_can_read_own_rights_after_local_access_is_removed(client,db,status):
    headers,company=_register_company(client,"identity-privacy-"+status)
    user=db.query(User).filter_by(company_id=company).one()
    member=db.query(CompanyMembership).filter_by(company_id=company,user_id=user.id).one()
    member.status=status
    member.permissions_configured=True
    db.commit()
    client.cookies.clear()
    login=client.post("/api/v1/auth/login",data=login_form(user.email))
    assert login.status_code==200,login.text
    identity_headers={"Authorization":"Bearer "+login.json()["access_token"]}
    assert client.get("/api/v1/users/me",headers=identity_headers).status_code==403
    assert client.get("/api/v1/privacy/requests",headers=identity_headers).status_code==403
    assert client.get("/api/v1/organization/members",headers=identity_headers).status_code==403
    created=client.post("/api/v1/privacy/requests",headers=identity_headers,json={"request_type":"access","reason":"Mis datos personales"})
    assert created.status_code==201,created.text
    assert created.json()["requested_by_user_id"]==user.id
    assert created.json()["company_id"]==company
    own=client.get("/api/v1/privacy/requests/me",headers=identity_headers)
    assert own.status_code==200,own.text
    assert [item["id"] for item in own.json()]==[created.json()["id"]]
    consents=client.get("/api/v1/privacy/consents",headers=identity_headers)
    assert consents.status_code==200,consents.text
    assert len(consents.json())==3
    exported=client.get("/api/v1/privacy/export",headers=identity_headers)
    assert exported.status_code==200,exported.text
    assert exported.json()["profile"]["id"]==user.id
    assert [item["id"] for item in exported.json()["rights_requests"]]==[created.json()["id"]]
    resolution=client.post(f"/api/v1/privacy/requests/{created.json()['id']}/resolve",headers=identity_headers,json={"decision":"complete","resolution_notes":"No permitido"})
    assert resolution.status_code==403
    assert db.get(User,user.id).is_active is True
    assert db.get(User,user.id).company_id==company


def test_personal_privacy_requires_valid_identity_and_never_returns_another_person(client,db):
    headers_a,company_a=_register_company(client,"identity-privacy-owner")
    headers_b,company_b=_register_company(client,"identity-privacy-other")
    own=client.post("/api/v1/privacy/requests",headers=headers_a,json={"request_type":"access"})
    other=client.post("/api/v1/privacy/requests",headers=headers_b,json={"request_type":"access"})
    assert own.status_code==201 and other.status_code==201
    assert client.get("/api/v1/privacy/requests/me",headers=headers_a).json()[0]["id"]==own.json()["id"]
    exported=client.get("/api/v1/privacy/export",headers=headers_a)
    assert exported.status_code==200
    assert other.json()["id"] not in {row["id"] for row in exported.json()["rights_requests"]}
    person=db.query(User).filter_by(company_id=company_a).one()
    person.session_version+=1
    db.commit()
    client.cookies.clear()
    for path in ["/api/v1/privacy/export","/api/v1/privacy/consents","/api/v1/privacy/requests/me"]:
        assert client.get(path).status_code==401
        assert client.get(path,headers={"Authorization":"Bearer invalid"}).status_code==401
        assert client.get(path,headers=headers_a).status_code==401
