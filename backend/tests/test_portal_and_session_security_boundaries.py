from app.core.security import create_access_token
from app.models.client import Client
from app.models.client_portal_grant import ClientPortalGrant
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.external_access_grant import ExternalAccessGrant
from app.models.role import Role
from app.models.user import User
from app.repositories import user as user_repo
from app.services import subscription_policy
from app.services.organization_membership_lifecycle import sync_administrator_profile
from tests.test_accountant_access import _company as _acc_company, _headers as _acc_headers


def _role_id(db, name: str) -> int:
    return db.query(Role).filter_by(name=name).one().id


def test_client_portal_workspace_list_excludes_canceled_provider(
    client, db, monkeypatch
):
    monkeypatch.setattr(
        subscription_policy.settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True
    )
    active_provider = _acc_company(db, "CP-ACTIVE")
    active_provider.subscription_plan = "top"
    canceled_provider = _acc_company(db, "CP-CANCELED")
    canceled_provider.subscription_plan = "top"
    canceled_provider.subscription_status = "canceled"

    c_active = Client(
        company_id=active_provider.id,
        name="Cliente Activo",
        address="Calle 1",
        city="Girona",
        postal_code="17001",
        country="España",
        is_active=True,
    )
    c_canceled = Client(
        company_id=canceled_provider.id,
        name="Cliente Cancelado",
        address="Calle 2",
        city="Girona",
        postal_code="17001",
        country="España",
        is_active=True,
    )
    db.add_all([c_active, c_canceled])
    db.flush()

    portal_user = User(
        company_id=None,
        email="cp-lifecycle@example.test",
        hashed_password="unused",
        full_name="Cliente Portal",
        role_id=_role_id(db, "client_portal"),
        is_active=True,
    )
    db.add(portal_user)
    db.flush()

    g_active = ClientPortalGrant(
        company_id=active_provider.id,
        client_id=c_active.id,
        user_id=portal_user.id,
        status="active",
    )
    g_canceled = ClientPortalGrant(
        company_id=canceled_provider.id,
        client_id=c_canceled.id,
        user_id=portal_user.id,
        status="active",
    )
    db.add_all([g_active, g_canceled])
    db.commit()

    token = create_access_token(
        {"sub": portal_user.email, "ver": portal_user.session_version}
    )
    headers = {"Authorization": f"Bearer {token}"}

    workspaces = client.get("/api/v1/client-portal/workspaces", headers=headers)
    assert workspaces.status_code == 200, workspaces.text
    assert [row["id"] for row in workspaces.json()] == [g_active.id]

    canceled_overview = client.get(
        f"/api/v1/client-portal/workspaces/{g_canceled.id}/overview", headers=headers
    )
    assert canceled_overview.status_code == 402


def test_accountant_portal_blocks_inactive_and_canceled_company_on_legacy_endpoints(
    client, db, monkeypatch
):
    monkeypatch.setattr(
        subscription_policy.settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True
    )
    active_co = _acc_company(db, "EXT-ACTIVE")
    active_co.subscription_plan = "top"
    inactive_co = _acc_company(db, "EXT-INACTIVE")
    inactive_co.subscription_plan = "top"
    inactive_co.is_active = False
    canceled_co = _acc_company(db, "EXT-CANCELED")
    canceled_co.subscription_plan = "top"
    canceled_co.subscription_status = "canceled"

    role_id = _role_id(db, "external_portal")
    accountant_active, headers_active = _acc_headers(db, active_co, role_id, "ext-b-act")
    accountant_inactive, headers_inactive = _acc_headers(db, inactive_co, role_id, "ext-b-ina")
    accountant_canceled, headers_canceled = _acc_headers(db, canceled_co, role_id, "ext-b-can")
    for target, acct in (
        (active_co, accountant_active),
        (inactive_co, accountant_inactive),
        (canceled_co, accountant_canceled),
    ):
        db.add(
            ExternalAccessGrant(
                company_id=target.id,
                user_id=acct.id,
                access_type="accountant",
                status="active",
            )
        )
    db.commit()

    assert (
        client.get(
            f"/api/v1/companies/{active_co.id}/expenses", headers=headers_active
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"/api/v1/companies/{inactive_co.id}/expenses", headers=headers_inactive
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/companies/{canceled_co.id}/expenses", headers=headers_canceled
        ).status_code
        == 402
    )


def test_revoke_company_sessions_invalidates_secondary_membership_only(client, db):
    company_a = Company(
        name="Multi A",
        tax_id="MULTI-A",
        address="Calle A",
        phone="600000001",
        email="multi-a@example.test",
        is_active=True,
        subscription_plan="mega",
        subscription_status="active",
    )
    company_b = Company(
        name="Multi B",
        tax_id="MULTI-B",
        address="Calle B",
        phone="600000002",
        email="multi-b@example.test",
        is_active=True,
        subscription_plan="mega",
        subscription_status="active",
    )
    db.add_all([company_a, company_b])
    db.flush()

    user = User(
        company_id=company_a.id,
        email="multi-member@example.com",
        hashed_password="unused",
        full_name="Multi Member",
        role_id=_role_id(db, "admin"),
        is_active=True,
    )
    db.add(user)
    db.flush()

    m_a = CompanyMembership(
        company_id=company_a.id,
        user_id=user.id,
        access_class="admin",
        status="active",
        permissions_configured=True,
    )
    m_b = CompanyMembership(
        company_id=company_b.id,
        user_id=user.id,
        access_class="admin",
        status="active",
        permissions_configured=True,
    )
    db.add_all([m_a, m_b])
    db.flush()
    sync_administrator_profile(db, m_a, actor_id=user.id)
    sync_administrator_profile(db, m_b, actor_id=user.id)
    db.commit()

    token_a = create_access_token(
        {
            "sub": user.email,
            "ver": user.session_version,
            "company_id": company_a.id,
            "membership_version": m_a.session_version,
        }
    )
    token_b = create_access_token(
        {
            "sub": user.email,
            "ver": user.session_version,
            "company_id": company_b.id,
            "membership_version": m_b.session_version,
        }
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert client.get("/api/v1/users/me", headers=headers_a).status_code == 200
    assert client.get("/api/v1/users/me", headers=headers_b).status_code == 200

    # Revoking Company B sessions must invalidate token_b while preserving token_a.
    user_repo.revoke_company_sessions(db, company_id=company_b.id)
    db.commit()

    assert client.get("/api/v1/users/me", headers=headers_b).status_code == 401
    assert client.get("/api/v1/users/me", headers=headers_a).status_code == 200
