from datetime import datetime, timedelta, timezone

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.subscription_entitlement import (
    EntitlementChangeAudit,
    CompanySubscription,
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


def _commercial_terms(
    *,
    amount_cents: int = 2900,
    billing_interval: str = "monthly",
    effective_at: datetime | None = None,
) -> dict[str, object]:
    return {
        "billing_interval": billing_interval,
        "amount_cents": amount_cents,
        "currency": "EUR",
        "tax_behavior": "exclusive",
        "effective_at": (effective_at or datetime.now(timezone.utc)).isoformat(),
    }


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
        json={
            "plan_code": "medium",
            "status": "active",
            "commercial_terms": _commercial_terms(amount_cents=6900),
            "reason": "Not allowed",
        },
    )

    assert read.status_code == 403
    assert write.status_code == 403

    current = client.get("/api/v1/companies/current/entitlements", headers=headers)
    assert current.status_code == 200
    assert any(
        item["code"] == "features.invoices" and item["value"] is True
        for item in current.json()["entitlements"]
    )


def test_generic_company_update_cannot_bypass_commercial_terms_workflow(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    response = client.patch(
        f"/api/v1/companies/{company.id}",
        headers=headers,
        json={"subscription_plan": "medium"},
    )

    assert response.status_code == 403
    assert "plan and access workflow" in response.json()["detail"]


def test_commercial_overview_is_platform_only_and_uses_lifecycle_facts(client, db):
    first = _company(db)
    headers = _platform_headers(client, db)

    second = Company(
        name="Commercial active company",
        tax_id="PLAN-COMMERCIAL-2",
        address="Plan Street 2",
        phone="600000102",
        email="commercial-active@example.test",
        subscription_plan="top",
        subscription_status="active",
    )
    attention = Company(
        name="Commercial attention company",
        tax_id="PLAN-COMMERCIAL-3",
        address="Plan Street 3",
        phone="600000103",
        email="commercial-attention@example.test",
        subscription_plan="medium",
        subscription_status="past_due",
    )
    db.add_all([second, attention])
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db, second, reason="test.setup"
    )
    company_entitlement_service.synchronize_company_subscription(
        db, attention, reason="test.setup"
    )
    db.commit()

    downgraded = client.put(
        f"/api/v1/companies/{first.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "basic",
            "status": "active",
            "commercial_terms": _commercial_terms(amount_cents=2900),
            "reason": "Commercial plan downgrade",
        },
    )
    assert downgraded.status_code == 200, downgraded.text
    upgraded = client.put(
        f"/api/v1/companies/{second.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "mega",
            "status": "active",
            "commercial_terms": _commercial_terms(amount_cents=24900),
            "reason": "Commercial plan upgrade",
        },
    )
    assert upgraded.status_code == 200, upgraded.text
    cancelled = client.put(
        f"/api/v1/companies/{second.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "mega",
            "status": "canceled",
            "reason": "Commercial cancellation",
        },
    )
    assert cancelled.status_code == 200, cancelled.text

    overview = client.get("/api/v1/companies/commercial-overview", headers=headers)
    assert overview.status_code == 200, overview.text
    payload = overview.json()
    assert payload["active_subscriptions"] == 1
    assert payload["trial_subscriptions"] == 0
    assert payload["payment_attention_subscriptions"] == 1
    assert payload["upgrades_last_30_days"] == 1
    assert payload["downgrades_last_30_days"] == 1
    assert payload["churned_last_30_days"] == 1
    assert payload["revenue_measurement_available"] is True
    assert payload["contracted_mrr_cents"] == 2900
    assert payload["active_subscriptions_without_commercial_terms"] == 0
    plans = {item["code"]: item for item in payload["plans"]}
    assert plans["basic"]["active_subscriptions"] == 1
    assert plans["basic"]["contracted_mrr_cents"] == 2900
    assert plans["medium"]["payment_attention_subscriptions"] == 1
    assert plans["mega"]["inactive_subscriptions"] == 1

    company_user = User(
        email="commercial-company-admin@workhive.test",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Commercial company administrator",
        role_id=1,
        company_id=first.id,
        is_active=True,
    )
    db.add(company_user)
    db.commit()
    login = client.post(
        "/api/v1/auth/login", data=login_form(company_user.email, TEST_SECRET)
    )
    denied = client.get(
        "/api/v1/companies/commercial-overview",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert denied.status_code == 403


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
    assert availability["features.api"] == "available"
    assert availability["features.integrations"] == "platform_internal"

    change = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "commercial_terms": _commercial_terms(
                amount_cents=70800,
                billing_interval="annual",
            ),
            "reason": "Signed annual medium subscription",
        },
    )
    assert change.status_code == 200
    assert change.json()["subscription"]["plan_code"] == "medium"
    assert change.json()["subscription"]["status"] == "active"
    commercial_terms = change.json()["subscription"]["commercial_terms"]
    assert commercial_terms["billing_interval"] == "annual"
    assert commercial_terms["amount_cents"] == 70800
    assert commercial_terms["currency"] == "EUR"
    assert commercial_terms["tax_behavior"] == "exclusive"
    assert commercial_terms["effective_at"]
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

    api_exception = client.post(
        f"/api/v1/companies/{company.id}/plan-access/overrides",
        headers=headers,
        json={
            "code": "features.api",
            "boolean_value": True,
            "reason": "API integration approved for this customer",
        },
    )
    assert api_exception.status_code == 201
    assert api_exception.json()["label"] == "Acceso API"
    assert api_exception.json()["value"] is True
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


def test_paid_terms_are_immutable_and_legacy_subscriptions_stay_out_of_mrr(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)
    effective_at = datetime.now(timezone.utc) - timedelta(days=2)

    first_terms = _commercial_terms(
        amount_cents=70800,
        billing_interval="annual",
        effective_at=effective_at,
    )
    first_change = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "commercial_terms": first_terms,
            "reason": "Initial annual agreement",
        },
    )

    assert first_change.status_code == 200, first_change.text
    first_subscription = (
        db.query(CompanySubscription)
        .filter(
            CompanySubscription.company_id == company.id,
            CompanySubscription.ended_at.is_(None),
        )
        .one()
    )
    assert first_subscription.commercial_amount_cents == 70800
    assert first_subscription.commercial_billing_interval == "annual"

    second_change = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "commercial_terms": _commercial_terms(
                amount_cents=60000,
                billing_interval="annual",
                effective_at=effective_at,
            ),
            "reason": "Signed renewal with negotiated price",
        },
    )

    assert second_change.status_code == 200, second_change.text
    db.refresh(first_subscription)
    assert first_subscription.ended_at is not None
    assert first_subscription.commercial_amount_cents == 70800
    current_subscription = (
        db.query(CompanySubscription)
        .filter(
            CompanySubscription.company_id == company.id,
            CompanySubscription.ended_at.is_(None),
        )
        .one()
    )
    assert current_subscription.id != first_subscription.id
    assert current_subscription.commercial_amount_cents == 60000

    legacy = Company(
        name="Historic agreement without terms",
        tax_id="PLAN-LEGACY-1",
        address="Plan Street 4",
        phone="600000104",
        email="commercial-legacy@example.test",
        subscription_plan="basic",
        subscription_status="active",
    )
    db.add(legacy)
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db, legacy, reason="test.legacy_setup"
    )
    db.commit()

    overview = client.get("/api/v1/companies/commercial-overview", headers=headers)

    assert overview.status_code == 200, overview.text
    payload = overview.json()
    assert payload["contracted_mrr_cents"] == 5000
    assert payload["active_subscriptions_without_commercial_terms"] == 1
    plans = {item["code"]: item for item in payload["plans"]}
    assert plans["medium"]["contracted_mrr_cents"] == 5000
    assert plans["basic"]["subscriptions_without_commercial_terms"] == 1


def test_active_plan_requires_terms_but_trials_do_not_accept_them(client, db):
    company = _company(db)
    headers = _platform_headers(client, db)

    missing_terms = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "reason": "Missing commercial agreement",
        },
    )
    trial_with_terms = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "top",
            "status": "trialing",
            "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "commercial_terms": _commercial_terms(),
            "reason": "Invalid paid trial",
        },
    )
    unsupported_currency = client.put(
        f"/api/v1/companies/{company.id}/plan-access",
        headers=headers,
        json={
            "plan_code": "medium",
            "status": "active",
            "commercial_terms": {
                **_commercial_terms(amount_cents=6900),
                "currency": "USD",
            },
            "reason": "Unsupported currency agreement",
        },
    )

    assert missing_terms.status_code == 422
    assert "require commercial terms" in str(missing_terms.json()["detail"])
    assert trial_with_terms.status_code == 422
    assert "cannot have paid commercial terms" in str(trial_with_terms.json()["detail"])
    assert unsupported_currency.status_code == 422
    assert "support EUR only" in str(unsupported_currency.json()["detail"])


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
            "commercial_terms": _commercial_terms(amount_cents=2900),
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
