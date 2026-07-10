import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.services import billing_service
from app.services import user_service
from app.services.subscription_policy import (
    evaluate_company_access,
    require_active_user_capacity,
)
from app.schemas.user import UserUpdate
from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD



def stripe_signature(payload: bytes, secret: str, timestamp: int) -> str:
    digest = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={digest}"


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
    assert company.subscription_plan == "business"
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
    monkeypatch.setattr(
        billing_service,
        "_stripe_post",
        lambda path, data: {
            "url": (
                "https://checkout.stripe.com/test-session"
                if path == "/checkout/sessions"
                else "https://billing.stripe.com/test-portal"
            )
        },
    )

    assert (
        billing_service.create_checkout_session(company, "business")
        == "https://checkout.stripe.com/test-session"
    )
    assert (
        billing_service.create_customer_portal(company)
        == "https://billing.stripe.com/test-portal"
    )


def test_subscription_access_policy_and_plan_limit(db, monkeypatch):
    company = Company(
        name="Trial Company",
        tax_id="BILLING-4",
        address="Test address",
        phone="000000003",
        email="trial@example.com",
        subscription_plan="trial",
        subscription_status="trialing",
    )
    db.add(company)
    db.flush()
    db.add_all(
        [
            User(
                email=f"trial-{index}@example.com",
                hashed_password="unused",
                role_id=1 if index == 0 else 3,
                company_id=company.id,
                is_active=True,
            )
            for index in range(5)
        ]
    )
    db.commit()

    monkeypatch.setattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", True)
    assert evaluate_company_access(company).allowed is True

    company.subscription_status = "past_due"
    access = evaluate_company_access(company)
    assert access.allowed is False
    assert access.reason == "past_due"

    with pytest.raises(HTTPException) as error:
        require_active_user_capacity(db, company)
    assert error.value.status_code == 409


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

    monkeypatch.setattr(
        billing_service,
        "create_customer_portal",
        lambda company: "https://billing.stripe.com/test-recovery",
    )
    portal = client.post("/api/v1/billing/portal", headers=headers)
    assert portal.status_code == 200
    assert portal.json()["url"] == "https://billing.stripe.com/test-recovery"


def test_reactivating_user_cannot_bypass_plan_limit(db):
    company = Company(
        name="Limited Company",
        tax_id="BILLING-6",
        address="Test address",
        phone="000000005",
        email="limited@example.com",
        subscription_plan="trial",
        subscription_status="trialing",
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
        for index in range(5)
    ]
    inactive_user = User(
        email="limited-inactive@example.com",
        hashed_password="unused",
        role_id=3,
        company_id=company.id,
        is_active=False,
    )
    db.add_all([*users, inactive_user])
    db.commit()

    with pytest.raises(HTTPException) as error:
        user_service.update_user(
            db,
            inactive_user.id,
            UserUpdate(is_active=True),
            users[0],
        )
    assert error.value.status_code == 409
