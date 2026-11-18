import pytest
from fastapi import HTTPException
from app.services.organization_membership_lifecycle import sync_administrator_profile
from app.models.company_membership import CompanyMembership
from app.services.company_hierarchy_service import save,parent
from app.services.consolidation_service import company_principal
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers


def test_company_group_requires_both_admin_scopes_and_rejects_cycles(client,db):
    first=_company(db,"group-first")
    second=_company(db,"group-second")
    stranger=_company(db,"group-stranger")
    for company in (first,second,stranger):company.subscription_plan="mega"
    db.flush()
    user=_bootstrap_admin(db,first,"group-owner")
    membership=CompanyMembership(user_id=user.id,company_id=second.id,access_class="admin",status="active");db.add(membership);db.flush()
    sync_administrator_profile(db,membership,actor_id=user.id);db.commit()
    body={"country":"ES","timezone":"Europe/Madrid","language":"es","parent_company_id":second.id}
    result=client.put("/api/v1/consolidation/settings",headers=_headers(user),json=body)
    assert result.status_code==200,result.text
    assert result.json()["parent_company_id"]==second.id
    with pytest.raises(HTTPException) as cycle:save(db,company_principal(db,user,second.id),second.id,first.id)
    assert cycle.value.status_code==409
    db.rollback()
    denied=client.put("/api/v1/consolidation/settings",headers=_headers(user),json={**body,"parent_company_id":stranger.id})
    assert denied.status_code==403
    assert parent(db,first.id)==second.id
    assert db.query(CompanyMembership).filter_by(user_id=user.id,company_id=stranger.id).count()==0


def test_group_does_not_inherit_home_administrator_rights_in_a_worker_membership(client,db):
    first=_company(db,"group-admin-home");second=_company(db,"group-worker-target")
    first.subscription_plan=second.subscription_plan="mega";db.flush()
    user=_bootstrap_admin(db,first,"group-cross-role")
    db.add(CompanyMembership(user_id=user.id,company_id=second.id,access_class="worker",status="active"));db.commit()
    result=client.put("/api/v1/consolidation/settings",headers=_headers(user),json={"country":"ES","timezone":"Europe/Madrid","language":"es","parent_company_id":second.id})
    assert result.status_code==403,result.text
    assert parent(db,first.id) is None
    db.refresh(user);assert user.company_id==first.id and user.role.name=="admin"
