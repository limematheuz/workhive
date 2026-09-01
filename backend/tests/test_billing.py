import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_purchase_intent import CompanyPurchaseIntent
from app.models.user import User
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.services import (
    billing_service,
    company_entitlement_service,
    organization_bootstrap_service,
    user_service,
)
from app.services.entitlement_catalog import (
    default_plan_values,
    is_commercially_available,
    legacy_plan_code,
)
from app.services.subscription_policy import evaluate_company_access
from app.schemas.user import UserUpdate
from credentials import TEST_SECRET, login_form



def stripe_signature(payload: bytes, secret: str, timestamp: int) -> str:
    digest = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={digest}"


def company_purchase_payload(
    *,
    plan: str = "basic",
    billing_interval: str = "monthly",
    owner_email: str = "new-owner@workhive.com",
) -> dict[str, object]:
    return {
        "plan": plan,
        "billing_interval": billing_interval,
        "company_name": "Paid Company",
        "tax_id": "PURCHASE-123",
        "address": "Paid Street 1",
        "postal_code": "08001",
        "city": "Barcelona",
        "province": "Barcelona",
        "phone": "600000001",
        "company_email": "billing@paid-company.example.com",
        "owner_full_name": "Paid Owner",
        "owner_email": owner_email,
        "accept_terms": True,
        "accept_privacy": True,
        "marketing_consent": False,
    }


def test_stripe_webhook_updates_company_subscription(db, monkeypatch):
    company = Company(
        name="Billing Company",
        tax_id="BILLING-1",
        address="Test address",
        phone="000000000",
        email="billing@example.com",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    secret = "whsec_test_secret"
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", secret)
    event = {
        "id": "evt_subscription_updated",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_123",
                "customer": "cus_123",
                "status": "active",
                "trial_end": None,
                "metadata": {
                    "company_id": str(company.id),
                    "plan": "business",
                },
            }
        },
    }
    payload = json.dumps(event, separators=(",", ":")).encode()
    timestamp = int(time.time())

    event_type = billing_service.process_webhook(
        db,
        payload,
        stripe_signature(payload, secret, timestamp),
    )

    db.refresh(company)
    assert event_type == "customer.subscription.updated"
    assert company.subscription_plan == "medium"
    assert company.subscription_status == "active"
    assert company.stripe_customer_id == "cus_123"
    assert company.stripe_subscription_id == "sub_123"
    assert company.is_active is True
    assert db.query(StripeWebhookEvent).count() == 1

    repeated_event_type = billing_service.process_webhook(
        db,
        payload,
        stripe_signature(payload, secret, timestamp),
    )

    assert repeated_event_type == "customer.subscription.updated"
    assert db.query(StripeWebhookEvent).count() == 1


def test_stripe_webhook_rejects_invalid_signature(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test_secret")

    with pytest.raises(HTTPException) as error:
        billing_service.verify_webhook_signature(
            b"{}",
            f"t={int(time.time())},v1=invalid",
        )

    assert error.value.status_code == 400


def test_stripe_webhook_handles_renewal_failure_and_cancellation(db, monkeypatch):
    company = Company(
        name="Lifecycle Company",
        tax_id="BILLING-2",
        address="Test address",
        phone="000000001",
        email="lifecycle@example.com",
        stripe_customer_id="cus_lifecycle",
        stripe_subscription_id="sub_lifecycle",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()

    secret = "whsec_test_secret"
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", secret)

    def send(event_id, event_type, stripe_object):
        event = {
            "id": event_id,
            "type": event_type,
            "data": {"object": stripe_object},
        }
        payload = json.dumps(event, separators=(",", ":")).encode()
        billing_service.process_webhook(
            db,
            payload,
            stripe_signature(payload, secret, int(time.time())),
        )
        db.refresh(company)

    send(
        "evt_failed",
        "invoice.payment_failed",
        {"customer": "cus_lifecycle"},
    )
    assert company.subscription_status == "past_due"
    assert company.is_active is True

    send(
        "evt_paid",
        "invoice.paid",
        {"customer": "cus_lifecycle"},
    )
    assert company.subscription_status == "active"

    send(
        "evt_deleted",
        "customer.subscription.deleted",
        {
            "id": "sub_lifecycle",
            "customer": "cus_lifecycle",
            "status": "canceled",
            "metadata": {"company_id": str(company.id), "plan": "pro"},
        },
    )
    assert company.subscription_status == "canceled"
    assert company.is_active is True


def test_checkout_and_portal_flows_without_real_stripe(db, monkeypatch):
    company = Company(
        name="Hosted Billing Company",
        tax_id="BILLING-3",
        address="Test address",
        phone="000000002",
        email="hosted@example.com",
        stripe_customer_id="cus_hosted",
    )
    db.add(company)
    db.commit()

    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_BUSINESS_PRICE_ID", "price_business")
    captured: dict[str, str] = {}

    def fake_stripe_post(path: str, data: dict[str, str]):
        captured.update(data)
        return {
            "url": (
                "https://checkout.stripe.com/test-session"
                if path == "/checkout/sessions"
                else "https://billing.stripe.com/test-portal"
            )
        }

    monkeypatch.setattr(billing_service, "_stripe_post", fake_stripe_post)

    assert (
        billing_service.create_checkout_session(db, company, "business")
        == "https://checkout.stripe.com/test-session"
    )
    assert captured["customer"] == "cus_hosted"
    assert "customer_email" not in captured
    assert captured["metadata[plan]"] == "medium"
    assert (
        billing_service.create_customer_portal(company)
        == "https://billing.stripe.com/test-portal"
    )


def test_public_plan_catalog_matches_the_active_purchasable_versions(
    client, monkeypatch
):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    for plan_code in ("BASIC", "MEDIUM", "TOP", "ENTERPRISE"):
        monkeypatch.setattr(
            settings, f"STRIPE_{plan_code}_MONTHLY_PRICE_ID", f"price_{plan_code.lower()}_monthly"
        )
        monkeypatch.setattr(
            settings, f"STRIPE_{plan_code}_ANNUAL_PRICE_ID", f"price_{plan_code.lower()}_annual"
        )

    response = client.get("/api/v1/billing/plans")

    assert response.status_code == 200, response.text
    plans = response.json()
    assert [plan["code"] for plan in plans] == ["basic", "medium", "top", "mega"]
    basic = plans[0]
    assert basic["version"] == 1
    assert basic["prices"] == [
        {
            "billing_interval": "monthly",
            "amount_cents": 2900,
            "currency": "EUR",
            "tax_behavior": "exclusive",
            "checkout_available": True,
        },
        {
            "billing_interval": "annual",
            "amount_cents": 28800,
            "currency": "EUR",
            "tax_behavior": "exclusive",
            "checkout_available": True,
        },
    ]
    assert {item["code"] for item in basic["entitlements"]} == {
        code
        for code in default_plan_values("basic")
        if not code.startswith("features.") or is_commercially_available(code)
    }
    assert all("label" not in item for item in basic["entitlements"])


def test_public_plan_catalog_does_not_advertise_internal_or_future_features(client):
    response = client.get("/api/v1/billing/plans")

    assert response.status_code == 200, response.text
    public_feature_codes = {
        entitlement["code"]
        for plan in response.json()
        for entitlement in plan["entitlements"]
        if entitlement["code"].startswith("features.")
    }
    assert "features.profitability" in public_feature_codes
    assert "features.accountant_portal" in public_feature_codes
    assert "features.planning" in public_feature_codes
    assert "features.integrations" not in public_feature_codes


def test_public_company_checkout_stores_an_intent_without_creating_a_tenant(
    client, db, monkeypatch
):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_BASIC_ANNUAL_PRICE_ID", "price_basic_annual")
    captured: dict[str, str] = {}

    def fake_stripe_post(path: str, data: dict[str, str]):
        captured.update(data)
        assert path == "/checkout/sessions"
        return {
            "id": "cs_paid_company",
            "url": "https://checkout.stripe.com/paid-company-session",
            "customer": "cus_paid_company",
            "subscription": "sub_paid_company",
        }

    monkeypatch.setattr(billing_service, "_stripe_post", fake_stripe_post)

    response = client.post(
        "/api/v1/billing/purchases/checkout",
        json=company_purchase_payload(billing_interval="annual"),
    )

    assert response.status_code == 201, response.text
    assert response.json()["url"] == "https://checkout.stripe.com/paid-company-session"
    purchase = db.query(CompanyPurchaseIntent).one()
    assert db.query(Company).count() == 0
    assert db.query(User).count() == 0
    assert purchase.status == "checkout_created"
    assert purchase.plan_code == "basic"
    assert purchase.billing_interval == "annual"
    assert purchase.stripe_checkout_session_id == "cs_paid_company"
    assert captured["client_reference_id"] == purchase.id
    assert captured["metadata[company_purchase_id]"] == purchase.id
    assert captured["metadata[billing_interval]"] == "annual"
    assert captured["line_items[0][price]"] == "price_basic_annual"
    assert captured["subscription_data[metadata][company_purchase_id]"] == purchase.id


def test_paid_company_purchase_activates_only_after_stripe_confirms_payment(
    client, db, monkeypatch
):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_paid_company")
    monkeypatch.setattr(settings, "STRIPE_BASIC_PRICE_ID", "price_basic")
    monkeypatch.setattr(
        billing_service,
        "_stripe_post",
        lambda *_: {
            "id": "cs_paid_activation",
            "url": "https://checkout.stripe.com/paid-activation-session",
            "customer": "cus_paid_activation",
            "subscription": "sub_paid_activation",
        },
    )
    sent: dict[str, str] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_paid_company_activation_email",
        lambda **kwargs: sent.update(kwargs) or True,
    )
    assert client.post(
        "/api/v1/billing/purchases/checkout",
        json=company_purchase_payload(),
    ).status_code == 201
    purchase = db.query(CompanyPurchaseIntent).one()

    event = {
        "id": "evt_paid_company_checkout",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_paid_activation",
                "mode": "subscription",
                "payment_status": "paid",
                "customer": "cus_paid_activation",
                "subscription": "sub_paid_activation",
                "metadata": {"company_purchase_id": purchase.id, "plan": "basic"},
            }
        },
    }
    webhook_payload = json.dumps(event, separators=(",", ":")).encode()
    billing_service.process_webhook(
        db,
        webhook_payload,
        stripe_signature(webhook_payload, "whsec_paid_company", int(time.time())),
    )

    db.refresh(purchase)
    assert purchase.status == "paid"
    assert purchase.activation_token_hash
    assert db.query(Company).count() == 0
    assert sent["recipient_email"] == "new-owner@workhive.com"
    token = parse_qs(urlparse(sent["activation_url"]).query)["token"][0]

    activation = client.post(
        "/api/v1/billing/purchases/activate",
        json={"token": token, "password": TEST_SECRET},
    )
    assert activation.status_code == 200, activation.text
    company = db.get(Company, activation.json()["company_id"])
    assert company is not None
    assert company.subscription_plan == "basic"
    assert company.subscription_status == "active"
    assert company.stripe_customer_id == "cus_paid_activation"
    assert company.stripe_subscription_id == "sub_paid_activation"
    owner = db.query(User).filter(User.company_id == company.id).one()
    assert owner.email == "new-owner@workhive.com"
    assert owner.role.name == "admin"
    assert client.post("/api/v1/auth/login", data=login_form(owner.email, TEST_SECRET)).status_code == 200
    db.refresh(purchase)
    assert purchase.status == "activated"
    assert purchase.activated_company_id == company.id
    assert purchase.activated_user_id == owner.id

    repeated = client.post(
        "/api/v1/billing/purchases/activate",
        json={"token": token, "password": TEST_SECRET},
    )
    assert repeated.status_code == 409


def test_unpaid_checkout_cannot_activate_a_company(client, db, monkeypatch):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_unpaid_company")
    monkeypatch.setattr(settings, "STRIPE_BASIC_PRICE_ID", "price_basic")
    monkeypatch.setattr(
        billing_service,
        "_stripe_post",
        lambda *_: {
            "id": "cs_unpaid_activation",
            "url": "https://checkout.stripe.com/unpaid-activation-session",
        },
    )
    assert client.post(
        "/api/v1/billing/purchases/checkout",
        json=company_purchase_payload(),
    ).status_code == 201
    purchase = db.query(CompanyPurchaseIntent).one()
    event = {
        "id": "evt_unpaid_company_checkout",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_unpaid_activation",
                "mode": "subscription",
                "payment_status": "unpaid",
                "metadata": {"company_purchase_id": purchase.id},
            }
        },
    }
    webhook_payload = json.dumps(event, separators=(",", ":")).encode()
    billing_service.process_webhook(
        db,
        webhook_payload,
        stripe_signature(webhook_payload, "whsec_unpaid_company", int(time.time())),
    )

    db.refresh(purchase)
    assert purchase.status == "checkout_completed"
    assert purchase.activation_token_hash is None
    assert db.query(Company).count() == 0


def test_expired_checkout_cannot_activate_a_company(client, db, monkeypatch):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_expired_company")
    monkeypatch.setattr(settings, "STRIPE_BASIC_PRICE_ID", "price_basic")
    monkeypatch.setattr(
        billing_service,
        "_stripe_post",
        lambda *_: {
            "id": "cs_expired_activation",
            "url": "https://checkout.stripe.com/expired-activation-session",
        },
    )
    assert client.post(
        "/api/v1/billing/purchases/checkout",
        json=company_purchase_payload(),
    ).status_code == 201
    purchase = db.query(CompanyPurchaseIntent).one()
    event = {
        "id": "evt_expired_company_checkout",
        "type": "checkout.session.expired",
        "data": {"object": {"id": "cs_expired_activation"}},
    }
    webhook_payload = json.dumps(event, separators=(",", ":")).encode()
    billing_service.process_webhook(
        db,
        webhook_payload,
        stripe_signature(webhook_payload, "whsec_expired_company", int(time.time())),
    )

    db.refresh(purchase)
    assert purchase.status == "expired"
    assert purchase.activation_token_hash is None
    assert db.query(Company).count() == 0


def test_invoice_paid_uses_the_subscription_metadata_snapshot(
    client, db, monkeypatch
):
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_invoice_metadata")
    monkeypatch.setattr(settings, "STRIPE_BASIC_PRICE_ID", "price_basic")
    monkeypatch.setattr(
        billing_service,
        "_stripe_post",
        lambda *_: {
            "id": "cs_invoice_metadata",
            "url": "https://checkout.stripe.com/invoice-metadata-session",
        },
    )
    monkeypatch.setattr(
        "app.services.email_service.send_paid_company_activation_email",
        lambda **_: True,
    )
    assert client.post(
        "/api/v1/billing/purchases/checkout",
        json=company_purchase_payload(),
    ).status_code == 201
    purchase = db.query(CompanyPurchaseIntent).one()
    event = {
        "id": "evt_invoice_metadata",
        "type": "invoice.paid",
        "data": {
            "object": {
                "customer": "cus_invoice_metadata",
                "parent": {
                    "subscription_details": {
                        "metadata": {"company_purchase_id": purchase.id},
                        "subscription": "sub_invoice_metadata",
                    }
                },
            }
        },
    }
    webhook_payload = json.dumps(event, separators=(",", ":")).encode()
    billing_service.process_webhook(
        db,
        webhook_payload,
        stripe_signature(webhook_payload, "whsec_invoice_metadata", int(time.time())),
    )

    db.refresh(purchase)
    assert purchase.status == "paid"
    assert purchase.stripe_customer_id == "cus_invoice_metadata"
    assert purchase.stripe_subscription_id == "sub_invoice_metadata"
    assert purchase.activation_token_hash


def test_enterprise_checkout_uses_the_canonical_plan_metadata(db, monkeypatch):
    company = Company(
        name="Enterprise Billing Company",
        tax_id="BILLING-ENTERPRISE",
        address="Test address",
        phone="000000008",
        email="enterprise-billing@example.com",
    )
    db.add(company)
    db.commit()

    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_ENTERPRISE_PRICE_ID", "price_enterprise")
    captured: dict[str, str] = {}

    def fake_stripe_post(path: str, data: dict[str, str]):
        captured.update(data)
        return {"url": "https://checkout.stripe.com/enterprise-session"}

    monkeypatch.setattr(billing_service, "_stripe_post", fake_stripe_post)

    assert (
        billing_service.create_checkout_session(db, company, "mega")
        == "https://checkout.stripe.com/enterprise-session"
    )
    assert captured["mode"] == "subscription"
    assert captured["line_items[0][price]"] == "price_enterprise"
    assert captured["customer_email"] == "enterprise-billing@example.com"
    assert captured["metadata[plan]"] == "mega"
    assert captured["subscription_data[metadata][plan]"] == "mega"


def test_lifetime_checkout_uses_payment_mode(db, monkeypatch):
    company = Company(
        name="Lifetime Billing Company",
        tax_id="BILLING-LIFETIME",
        address="Test address",
        phone="000000009",
        email="lifetime@example.com",
    )
    db.add(company)
    db.commit()

    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_local")
    monkeypatch.setattr(settings, "STRIPE_LIFETIME_PRICE_ID", "price_lifetime")

    captured: dict[str, str] = {}

    def fake_stripe_post(path: str, data: dict[str, str]):
        captured.update(data)
        return {"url": "https://checkout.stripe.com/lifetime-session"}

    monkeypatch.setattr(billing_service, "_stripe_post", fake_stripe_post)

    assert (
        billing_service.create_checkout_session(db, company, "lifetime")
        == "https://checkout.stripe.com/lifetime-session"
    )
    assert captured["mode"] == "payment"
    assert captured["line_items[0][price]"] == "price_lifetime"
    assert captured["metadata[plan]"] == "top"
    assert "subscription_data[metadata][plan]" not in captured


def test_lifetime_checkout_webhook_activates_company(db, monkeypatch):
    company = Company(
        name="Lifetime Webhook Company",
        tax_id="BILLING-LIFETIME-2",
        address="Test address",
        phone="000000010",
        email="lifetime-webhook@example.com",
        subscription_plan="none",
        subscription_status="inactive",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    secret = "whsec_test_secret"
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", secret)
    event = {
        "id": "evt_lifetime_checkout",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_lifetime",
                "mode": "payment",
                "customer": "cus_lifetime",
                "subscription": None,
                "client_reference_id": str(company.id),
                "metadata": {
                    "company_id": str(company.id),
                    "plan": "lifetime",
                },
            }
        },
    }
    payload = json.dumps(event, separators=(",", ":")).encode()
    timestamp = int(time.time())

    event_type = billing_service.process_webhook(
        db,
        payload,
        stripe_signature(payload, secret, timestamp),
    )

    db.refresh(company)
    assert event_type == "checkout.session.completed"
    assert company.subscription_plan == "top"
    assert company.subscription_status == "active"
    assert company.stripe_customer_id == "cus_lifetime"


def test_subscription_access_policy_and_trial_member_limits(db, monkeypatch):
    company = Company(
        name="Trial Company",
        tax_id="BILLING-4",
        address="Test address",
        phone="000000003",
        email="trial@example.com",
        subscription_plan="top",
        subscription_status="trialing",
    )
    db.add(company)
    db.flush()
    db.commit()

    monkeypatch.setattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True)
    assert evaluate_company_access(company).allowed is True

    company.subscription_status = "past_due"
    access = evaluate_company_access(company)
    assert access.allowed is False
    assert access.reason == "past_due"

    company.subscription_status = "pending"
    access = evaluate_company_access(company)
    assert access.allowed is False
    assert access.reason == "pending"

    assert legacy_plan_code("trial") == "top"
    assert default_plan_values("trial")["limits.internal_admins"] == 10
    assert default_plan_values("trial")["limits.internal_responsibles"] == 20
    assert default_plan_values("trial")["limits.internal_workers"] == 100


def test_billing_recovery_routes_remain_available_when_access_is_blocked(
    client,
    db,
    monkeypatch,
):
    company = Company(
        name="Past Due Company",
        tax_id="BILLING-5",
        address="Test address",
        phone="000000004",
        email="past-due@example.com",
        subscription_plan="business",
        subscription_status="past_due",
        stripe_customer_id="cus_past_due",
    )
    db.add(company)
    db.flush()
    admin = User(
        email="past-due-admin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(admin)
    db.commit()

    monkeypatch.setattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True)
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(admin.email, TEST_SECRET) if False else {"username": admin.email, __import__("credentials").CREDENTIAL_FIELD: TEST_SECRET,},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/users/me", headers=headers).status_code == 402

    summary = client.get("/api/v1/billing/subscription", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["access_allowed"] is False
    assert summary.json()["access_reason"] == "past_due"
    assert summary.json()["internal_member_limits"] == {
        "administrators": 3,
        "responsibles": 8,
        "workers": 25,
    }

    monkeypatch.setattr(
        billing_service,
        "create_customer_portal",
        lambda company: "https://billing.stripe.com/test-recovery",
    )
    portal = client.post("/api/v1/billing/portal", headers=headers)
    assert portal.status_code == 200
    assert portal.json()["url"] == "https://billing.stripe.com/test-recovery"


def test_canceled_company_can_sign_in_only_for_billing_recovery(client, db, monkeypatch):
    company = Company(
        name="Canceled recovery company",
        tax_id="BILLING-CANCELED-RECOVERY",
        address="Test address",
        phone="000000014",
        email="canceled-recovery@example.com",
        subscription_plan="medium",
        subscription_status="canceled",
        stripe_customer_id="cus_canceled_recovery",
    )
    db.add(company)
    db.flush()
    admin = User(
        email="canceled-recovery-admin@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(admin)
    db.commit()

    monkeypatch.setattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True)
    login = client.post("/api/v1/auth/login", data=login_form(admin.email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    assert client.get("/api/v1/users/me", headers=headers).status_code == 402
    summary = client.get("/api/v1/billing/subscription", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["access_allowed"] is False
    assert summary.json()["access_reason"] == "canceled"


def test_reactivating_user_cannot_bypass_plan_limit(db):
    company = Company(
        name="Limited Company",
        tax_id="BILLING-6",
        address="Test address",
        phone="000000005",
        email="limited@example.com",
        subscription_plan="free",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    users = [
        User(
            email=f"limited-{index}@example.com",
            hashed_password="unused",
            role_id=1 if index == 0 else 3,
            company_id=company.id,
            is_active=True,
        )
        for index in range(6)
    ]
    inactive_user = User(
        email="limited-inactive@example.com",
        hashed_password="unused",
        role_id=3,
        company_id=company.id,
        is_active=False,
    )
    db.add_all([*users, inactive_user])
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason="test.plan_changed",
    )
    for user in [*users, inactive_user]:
        organization_bootstrap_service.ensure_user_membership(db, user)
    db.commit()

    with pytest.raises(HTTPException) as error:
        user_service.update_user(
            db,
            inactive_user.id,
            UserUpdate(is_active=True),
            users[0],
        )
    assert error.value.status_code == 409


def test_reactivating_user_activates_their_membership_when_capacity_allows(db):
    company = Company(
        name="Reactivation Company",
        tax_id="BILLING-REACTIVATE",
        address="Test address",
        phone="000000005",
        email="reactivate@example.com",
        subscription_plan="free",
        subscription_status="active",
    )
    admin = User(
        email="reactivation-admin@example.com",
        hashed_password="unused",
        role_id=1,
        company=company,
        is_active=True,
    )
    worker = User(
        email="reactivation-worker@example.com",
        hashed_password="unused",
        role_id=3,
        company=company,
        is_active=False,
    )
    db.add_all([company, admin, worker])
    db.flush()
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason="test.plan_changed",
    )
    organization_bootstrap_service.ensure_user_membership(db, admin)
    membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    db.commit()

    updated = user_service.update_user(
        db,
        worker.id,
        UserUpdate(is_active=True),
        admin,
    )

    assert updated.is_active is True
    assert membership.status == "active"
