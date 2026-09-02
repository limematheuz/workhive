from datetime import datetime, timedelta, timezone

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.subscription_entitlement import (
    EntitlementChangeAudit,
    PlanCatalogAudit,
    PlanPrice,
    SubscriptionPlan,
)
from app.models.user import User
from app.services import company_entitlement_service
from credentials import TEST_SECRET, TEST_SUPER, login_form


def _platform_headers(client, db) -> dict[str, str]:
    superadmin = User(
        email="plan-superadmin@workhive.test",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="Platform plan administrator",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    response = client.post(
        "/api/v1/auth/login", data=login_form(superadmin.email, TEST_SUPER)
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _company(db) -> Company:
    now = datetime.now(timezone.utc)
    company = Company(
        name="Plan management company",
        tax_id="PLAN-API-1",
        address="Plan Street 1",
        phone="600000101",
        email="plan-management@example.test",
        subscription_plan="top",
        subscription_status="trialing",
        trial_started_at=now,
        trial_ends_at=now + timedelta(days=14),
    )
    db.add(company)
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db, company, reason="test.setup"
    )
    db.commit()
    db.refresh(company)
    return company


def _add_active_worker(db, company: Company, index: int) -> None:
    worker = User(
        email=f"plan-worker-{index}@workhive.test",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name=f"Plan worker {index}",
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(worker)
    db.flush()
    db.add(
        CompanyMembership(
            company_id=company.id,
            user_id=worker.id,
            access_class="worker",
            status="active",
        )
    )


def test_only_platform_superadmin_can_read_or_change_plan_access(client, db):
    company = _company(db)
    company_admin = User(
        email="company-plan-admin@workhive.test",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Company plan administrator",
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(company_admin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login", data=login_form(company_admin.email, TEST_SECRET)
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    read = client.get(f"/api/v1/companies/{company.id}/plan-access", headers=headers)
    write = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={"plan_code": "medium", "status": "active", "reason": "Not allowed"},
    )

    assert read.status_code == 403
    assert write.status_code == 403

    current = client.get("/api/v1/companies/current/entitlements", headers=headers)
    assert current.status_code == 200
    assert any(
        item["code"] == "features.invoices" and item["value"] is True
        for item in current.json()["entitlements"]
    )


def test_platform_superadmin_changes_plan_and_creates_audited_exception(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    catalog = client.get("/api/v1/companies/plans/catalog", headers=headers)
    assert catalog.status_code == 200
    assert {item["code"] for item in catalog.json()} == {
        "basic",
        "medium",
        "top",
        "mega",
        "custom",
    }
    assert next(item for item in catalog.json() if item["code"] == "mega")["label"] == "Enterprise"
    mega = next(item for item in catalog.json() if item["code"] == "mega")
    availability = {item["code"]: item["availability"] for item in mega["entitlements"]}
    assert availability["features.profitability"] == "available"
    assert availability["features.planning"] == "available"
    assert availability["features.integrations"] == "platform_internal"

    change = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "reason": "Signed annual medium subscription",
        },
    )
    assert change.status_code == 200
    assert change.json()["subscription"]["plan_code"] == "medium"
    assert change.json()["subscription"]["status"] == "active"
    assert any(
        item["label"] == "Catálogo de servicios" and item["value"] is True
        for item in change.json()["entitlements"]
    )

    exception = client.post(
        f"/api/v1/companies/{company.id}/plan-access/overrides",
        headers=headers,
        json={
            "code": "features.inventory",
            "boolean_value": True,
            "reason": "Inventory pilot approved for this customer",
        },
    )
    assert exception.status_code == 201
    assert exception.json()["label"] == "Inventario"
    assert exception.json()["value"] is True

    refreshed = client.get(
        f"/api/v1/companies/{company.id}/plan-access", headers=headers
    )
    assert refreshed.status_code == 200
    assert any(
        item["label"] == "Inventario" and item["value"] is True
        for item in refreshed.json()["entitlements"]
    )
    assert any(
        item["action"] == "entitlement.override_set"
        for item in refreshed.json()["audit"]
    )
    assert (
        db.query(EntitlementChangeAudit)
        .filter_by(company_id=company.id, action="subscription.manually_changed")
        .count()
        == 1
    )


def test_trial_access_is_always_the_top_plan(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    invalid = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "basic",
            "status": "trialing",
            "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "reason": "Invalid trial",
        },
    )

    assert invalid.status_code == 422


def test_custom_access_is_a_company_configuration_not_a_standard_subscription(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    invalid = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "custom",
            "status": "active",
            "reason": "This must use the dedicated customization flow",
        },
    )

    assert invalid.status_code == 422
    assert "customization endpoint" in str(invalid.json()["detail"])


def test_invalid_custom_access_is_reported_as_a_validation_error(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    invalid = client.post(
        f"/api/v1/companies/{company.id}/plan-access/overrides",
        headers=headers,
        json={
            "code": "features.not_real",
            "boolean_value": True,
            "reason": "Invalid exception",
        },
    )

    assert invalid.status_code == 422
    assert invalid.json()["detail"] == "Unknown entitlement code: features.not_real"


def _entitlement_payload(entries, *, changes=None):
    changes = changes or {}
    payload = []
    for entry in entries:
        value = changes.get(entry["code"], entry["value"])
        payload.append(
            {
                "code": entry["code"],
                "boolean_value": value if entry["value_type"] == "boolean" else None,
                "integer_value": value if entry["value_type"] == "integer" else None,
            }
        )
    return payload


def test_platform_superadmin_publishes_a_new_plan_version_without_changing_old_subscription(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)
    catalog = client.get("/api/v1/companies/plans/catalog", headers=headers).json()
    top = next(item for item in catalog if item["code"] == "top")

    changed = client.put(
        "/api/v1/companies/plans/top",
        headers=headers,
        json={
            "reason": "New public Top package",
            "entitlements": _entitlement_payload(
                top["entitlements"],
                changes={"limits.internal_workers": 125},
            ),
        },
    )

    assert changed.status_code == 200
    assert changed.json()["version"] == top["version"] + 1
    assert next(
        item
        for item in changed.json()["entitlements"]
        if item["code"] == "limits.internal_workers"
    )["value"] == 125
    assert (
        db.query(PlanPrice)
        .join(SubscriptionPlan)
        .filter(
            SubscriptionPlan.code == "top",
            SubscriptionPlan.version == changed.json()["version"],
        )
        .count()
        == 2
    )
    assert (
        db.query(PlanCatalogAudit)
        .filter_by(plan_code="top", reason="New public Top package")
        .count()
        == 1
    )

    company_access = client.get(
        f"/api/v1/companies/{company.id}/plan-access", headers=headers
    )
    assert company_access.status_code == 200
    assert company_access.json()["subscription"]["plan_version"] == top["version"]
    assert next(
        item
        for item in company_access.json()["base_entitlements"]
        if item["code"] == "limits.internal_workers"
    )["value"] == 100


def test_platform_superadmin_replaces_a_company_custom_configuration_atomically(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)
    before = client.get(
        f"/api/v1/companies/{company.id}/plan-access", headers=headers
    ).json()

    saved = client.put(
        f"/api/v1/companies/{company.id}/plan-access/customization",
        headers=headers,
        json={
            "reason": "Enterprise expansion agreed",
            "entitlements": _entitlement_payload(
                before["base_entitlements"],
                changes={
                    "features.advanced_integrations": True,
                    "limits.internal_workers": 250,
                },
            ),
        },
    )

    assert saved.status_code == 200
    entitlements = {item["code"]: item for item in saved.json()["entitlements"]}
    assert entitlements["features.advanced_integrations"]["value"] is True
    assert entitlements["features.advanced_integrations"]["source"] == "exception"
    assert entitlements["limits.internal_workers"]["value"] == 250
    assert len(saved.json()["overrides"]) == 2

    cleared = client.put(
        f"/api/v1/companies/{company.id}/plan-access/customization",
        headers=headers,
        json={
            "reason": "Return to the contracted Top plan",
            "entitlements": _entitlement_payload(before["base_entitlements"]),
        },
    )

    assert cleared.status_code == 200
    assert cleared.json()["overrides"] == []
    assert any(
        item["action"] == "entitlement.customization_replaced"
        for item in cleared.json()["audit"]
    )


def test_platform_superadmin_cannot_reduce_capacity_below_current_usage(client, db):
    company = _company(db)
    for index in range(6):
        _add_active_worker(db, company, index)
    db.commit()
    headers = _platform_headers(client, db)

    plan_change = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "basic",
            "status": "active",
            "reason": "Attempt to downgrade below current workforce",
        },
    )

    assert plan_change.status_code == 409
    assert plan_change.headers["X-WorkHive-Error-Code"] == "entitlement.capacity_below_current_usage"
    assert "Trabajadores: 6 en uso, límite propuesto 5" in plan_change.json()["detail"]

    before = client.get(
        f"/api/v1/companies/{company.id}/plan-access", headers=headers
    ).json()
    customization = client.put(
        f"/api/v1/companies/{company.id}/plan-access/customization",
        headers=headers,
        json={
            "reason": "Attempt to reduce custom worker capacity",
            "entitlements": _entitlement_payload(
                before["base_entitlements"],
                changes={"limits.internal_workers": 5},
            ),
        },
    )

    assert customization.status_code == 409
    assert customization.headers["X-WorkHive-Error-Code"] == "entitlement.capacity_below_current_usage"

    override = client.post(
        f"/api/v1/companies/{company.id}/plan-access/overrides",
        headers=headers,
        json={
            "code": "limits.internal_workers",
            "integer_value": 5,
            "reason": "Attempt to bypass the capacity rule",
        },
    )

    assert override.status_code == 409
    assert override.headers["X-WorkHive-Error-Code"] == "entitlement.capacity_below_current_usage"
