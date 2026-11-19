from datetime import datetime, timedelta, timezone

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.role import Role
from app.models.user import User
from app.services.organization_membership_lifecycle import sync_administrator_profile
from tests.credentials import TEST_SECRET, login_form


def _role_id(db, name: str) -> int:
    return db.query(Role).filter_by(name=name).one().id


def _company(db, slug: str, **kwargs) -> Company:
    defaults = {
        "name": f"SubLife {slug}",
        "tax_id": f"SL-{slug.upper()}",
        "address": "Calle Ciclo 1",
        "phone": "600000000",
        "email": f"{slug}@example.com",
        "is_active": True,
        "subscription_plan": "top",
        "subscription_status": "active",
    }
    defaults.update(kwargs)
    company = Company(**defaults)
    db.add(company)
    db.flush()
    return company


def test_login_with_expired_trial_and_bumped_membership_version_returns_402(client, db):
    company = _company(
        db,
        "expired-ver",
        subscription_status="trialing",
        trial_ends_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    admin = User(
        company_id=company.id,
        email="expired-ver-admin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Expired Admin",
        role_id=_role_id(db, "admin"),
        is_active=True,
    )
    db.add(admin)
    db.flush()
    membership = CompanyMembership(
        company_id=company.id,
        user_id=admin.id,
        access_class="admin",
        status="active",
        permissions_configured=True,
        session_version=2,
    )
    db.add(membership)
    db.flush()
    sync_administrator_profile(db, membership, actor_id=admin.id)
    db.commit()

    # Wrong password still returns 401 without revealing subscription state.
    bad = client.post(
        "/api/v1/auth/login",
        data={"username": admin.email, "password": "wrong-password-123"},
    )
    assert bad.status_code == 401

    # Valid credentials sign in and immediately report 402 trial_expired (never 401).
    login = client.post("/api/v1/auth/login", data=login_form(admin.email))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 402, me.text
    assert me.headers.get("X-WorkHive-Error-Code") == "subscription.trial_expired"

    # Billing recovery remains accessible with the same token.
    billing = client.get("/api/v1/billing/subscription", headers=headers)
    assert billing.status_code == 200, billing.text


def test_login_prefers_active_company_when_base_company_trial_expired(client, db):
    expired = _company(
        db,
        "multi-exp",
        subscription_status="trialing",
        trial_ends_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    active = _company(db, "multi-act", subscription_status="active")
    user = User(
        company_id=expired.id,
        email="multi-sub-admin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Multi Sub Admin",
        role_id=_role_id(db, "admin"),
        is_active=True,
    )
    db.add(user)
    db.flush()
    for target in (expired, active):
        m = CompanyMembership(
            company_id=target.id,
            user_id=user.id,
            access_class="admin",
            status="active",
            permissions_configured=True,
            session_version=2,
        )
        db.add(m)
        db.flush()
        sync_administrator_profile(db, m, actor_id=user.id)
    db.commit()

    login = client.post("/api/v1/auth/login", data=login_form(user.email))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["company_id"] == active.id
