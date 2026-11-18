"""Identity erasure protects administration beyond the identity's primary role."""

import pytest
from fastapi import HTTPException

from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.user import User
from app.services.privacy_service import _anonymize_user
from tests.test_user_invitations import _register_company


def _multi_company_admin(client,db):
    _,company_a=_register_company(client,"privacy-admin-scope-a")
    _,company_b=_register_company(client,"privacy-admin-scope-b")
    user=db.query(User).filter_by(company_id=company_a).one()
    user.role_id=3
    membership_a=db.query(CompanyMembership).filter_by(company_id=company_a,user_id=user.id).one()
    membership_a.access_class="worker"
    # The old global administrator of B no longer has an active B membership.
    original_b=db.query(CompanyMembership).filter_by(company_id=company_b,access_class="admin").one()
    original_b.status="suspended"
    db.add(CompanyMembership(company_id=company_b,user_id=user.id,access_class="admin",status="active"))
    db.commit()
    db.refresh(user)
    assert user.role.name=="viewer"
    return user,company_a,company_b


def test_erasure_denied_when_identity_is_last_administrator_of_another_company(client,db):
    user,company_a,company_b=_multi_company_admin(client,db)
    before=(user.email,user.session_version,user.is_active)
    with pytest.raises(HTTPException) as caught:
        _anonymize_user(db,user.id)
    assert caught.value.status_code==409
    assert (user.email,user.session_version,user.is_active)==before
    assert db.get(Company,company_a).is_active is True
    assert db.get(Company,company_b).is_active is True
    assert db.query(CompanyMembership).filter_by(company_id=company_b,user_id=user.id).one().status=="active"


def test_erasure_preserves_other_company_when_another_real_membership_administrator_remains(client,db):
    user,company_a,company_b=_multi_company_admin(client,db)
    other=User(email="privacy-other-multi-admin@example.com",hashed_password="unused",role_id=3,company_id=company_a,is_active=True)
    db.add(other);db.flush()
    db.add(CompanyMembership(company_id=company_b,user_id=other.id,access_class="admin",status="active"))
    db.commit()
    _anonymize_user(db,user.id)
    db.commit()
    assert user.is_active is False
    assert db.get(Company,company_a).is_active is True
    assert db.get(Company,company_b).is_active is True
    assert other.is_active is True
    assert other.role.name=="viewer"
    assert db.query(CompanyMembership).filter_by(company_id=company_b,user_id=other.id).one().status=="active"
