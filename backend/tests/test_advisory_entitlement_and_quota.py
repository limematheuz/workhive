from app.models.advisory_access import AdvisoryAccess
from app.models.external_access_grant import ExternalAccessGrant
from app.models.role import Role
from app.services import subscription_policy
from app.services.company_entitlement_service import set_company_entitlement_override
from tests.test_accountant_access import _company, _headers
from tests.test_client_permission_authorization import (
    _bootstrap_admin,
    _headers as admin_headers,
)


def test_advisory_companies_and_areas_enforce_plan_active_company_and_subscription(
    client, db, monkeypatch
):
    monkeypatch.setattr(
        subscription_policy.settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True
    )
    basic_company = _company(db, "ADV-BASIC")
    basic_company.subscription_plan = "basic"
    basic_owner = _bootstrap_admin(db, basic_company, "adv-basic-owner")

    top_company = _company(db, "ADV-TOP")
    top_company.subscription_plan = "top"

    inactive_company = _company(db, "ADV-INACTIVE")
    inactive_company.subscription_plan = "top"
    inactive_company.is_active = False

    canceled_company = _company(db, "ADV-CANCELED")
    canceled_company.subscription_plan = "top"
    canceled_company.subscription_status = "canceled"

    no_hr_company = _company(db, "ADV-NOHR")
    no_hr_company.subscription_plan = "top"
    set_company_entitlement_override(
        db,
        company_id=no_hr_company.id,
        code="features.hr",
        value=False,
        reason="Disable HR for advisory test",
        actor_user_id=basic_owner.id,
    )

    role = db.query(Role).filter_by(name="external_portal").one()
    adviser, headers = _headers(db, top_company, role.id, "adv-plan-check")
    for target, acc, pay in (
        (basic_company, True, False),
        (top_company, True, True),
        (inactive_company, True, False),
        (canceled_company, True, False),
        (no_hr_company, False, True),
    ):
        grant = ExternalAccessGrant(
            company_id=target.id,
            user_id=adviser.id,
            access_type="accountant",
            status="active",
        )
        db.add(grant)
        db.flush()
        db.add(AdvisoryAccess(grant_id=grant.id, accounting=acc, payroll=pay))
    db.commit()

    # External adviser must only see active, entitled companies with an effective area.
    listed = client.get("/api/v1/advisory/companies", headers=headers)
    assert listed.status_code == 200, listed.text
    assert [row["id"] for row in listed.json()] == [top_company.id]

    # Internal admin on Basic must be blocked from advisory listing.
    basic_internal = client.get(
        "/api/v1/advisory/companies", headers=admin_headers(basic_owner)
    )
    assert basic_internal.status_code == 403

    # Inactive and canceled companies must fail closed even on direct area requests.
    assert (
        client.get(
            f"/api/v1/advisory-accounting/{inactive_company.id}?month=2026-11",
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/advisory-accounting/{canceled_company.id}?month=2026-11",
            headers=headers,
        ).status_code
        == 402
    )


def test_advisory_save_grant_enforces_accountant_quota_and_bumps_session_version(
    client, db
):
    company = _company(db, "ADV-QUOTA")
    company.subscription_plan = "top"
    owner = _bootstrap_admin(db, company, "adv-quota-owner")
    set_company_entitlement_override(
        db,
        company_id=company.id,
        code="limits.accountant_portals",
        value=1,
        reason="Quota boundary test",
        actor_user_id=owner.id,
    )
    role = db.query(Role).filter_by(name="external_portal").one()
    first, _ = _headers(db, company, role.id, "adv-quota-1")
    second, _ = _headers(db, company, role.id, "adv-quota-2")
    db.commit()

    headers = admin_headers(owner)
    # First accountant fills the single Top slot.
    res1 = client.put(
        "/api/v1/advisory/grants",
        headers=headers,
        json={"email": first.email, "accounting": True, "payroll": False},
    )
    assert res1.status_code == 200, res1.text

    # Updating the already-active first accountant must stay allowed.
    res1_update = client.put(
        "/api/v1/advisory/grants",
        headers=headers,
        json={"email": first.email, "accounting": True, "payroll": True},
    )
    assert res1_update.status_code == 200, res1_update.text

    # Adding a second active accountant must be blocked by limits.accountant_portals (409).
    res2_blocked = client.put(
        "/api/v1/advisory/grants",
        headers=headers,
        json={"email": second.email, "accounting": True, "payroll": False},
    )
    assert res2_blocked.status_code == 409, res2_blocked.text

    # Revoking the first accountant bumps session_version and frees the slot.
    grant1 = (
        db.query(ExternalAccessGrant)
        .filter_by(company_id=company.id, user_id=first.id)
        .one()
    )
    version_before = grant1.session_version
    res1_revoke = client.put(
        "/api/v1/advisory/grants",
        headers=headers,
        json={"email": first.email, "accounting": False, "payroll": False},
    )
    assert res1_revoke.status_code == 200, res1_revoke.text
    db.refresh(grant1)
    assert grant1.status == "revoked"
    assert grant1.session_version == version_before + 1

    # Now the second accountant fits in the freed slot.
    res2_allowed = client.put(
        "/api/v1/advisory/grants",
        headers=headers,
        json={"email": second.email, "accounting": True, "payroll": False},
    )
    assert res2_allowed.status_code == 200, res2_allowed.text
