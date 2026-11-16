import json
import time

import httpx

from app.core.config import settings
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.services import billing_service
from tests.test_billing import stripe_signature


def test_checkout_and_signed_webhook_lifecycle_without_external_payments(
    client, db, api_workspace, monkeypatch
):
    qa = api_workspace
    secret = "whsec_contract_simulation_only"
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(
        settings, "STRIPE_SECRET_KEY", "sk_test_contract_simulation_only"
    )
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(
        settings, "STRIPE_BUSINESS_PRICE_ID", "price_contract_simulation"
    )
    requests = []

    def stripe_transport(url, *, data, headers, timeout):
        assert url == billing_service.STRIPE_API_URL + "/checkout/sessions"
        assert headers["Authorization"] == "Bearer sk_test_contract_simulation_only"
        requests.append(data)
        return httpx.Response(
            200,
            json={"url": "https://checkout.stripe.com/c/pay/cs_test_simulation"},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(billing_service.httpx, "post", stripe_transport)
    body = {"plan": "business", "billing_interval": "monthly"}
    assert (
        client.post(
            "/api/v1/billing/checkout", headers=qa.headers["worker"], json=body
        ).status_code
        == 403
    )
    assert requests == []
    checkout = client.post(
        "/api/v1/billing/checkout", headers=qa.headers["admin"], json=body
    )
    assert checkout.status_code == 200, checkout.text
    assert checkout.json()["url"].endswith("cs_test_simulation")
    assert requests[0]["client_reference_id"] == str(qa.company.id)
    assert requests[0]["subscription_data[metadata][company_id]"] == str(qa.company.id)
    assert requests[0]["subscription_data[metadata][plan]"] == "medium"
    db.refresh(qa.company)
    assert (
        qa.company.subscription_plan == "mega"
    )  # Opening checkout never grants a plan.

    def event(event_id, event_type, stripe_object, *, valid=True):
        payload = json.dumps(
            {"id": event_id, "type": event_type, "data": {"object": stripe_object}},
            separators=(",", ":"),
        ).encode()
        signature = stripe_signature(
            payload, secret if valid else "invalid", int(time.time())
        )
        return client.post(
            "/api/v1/billing/webhook",
            content=payload,
            headers={"Stripe-Signature": signature, "Content-Type": "application/json"},
        )

    subscription = {
        "id": "sub_contract",
        "customer": "cus_contract",
        "status": "active",
        "metadata": {
            "company_id": str(qa.company.id),
            "plan": "business",
            "billing_interval": "monthly",
        },
        "start_date": int(time.time()),
    }
    assert (
        event(
            "evt_contract_active",
            "customer.subscription.updated",
            subscription,
            valid=False,
        ).status_code
        == 400
    )
    assert db.query(StripeWebhookEvent).count() == 0
    active = event("evt_contract_active", "customer.subscription.updated", subscription)
    assert active.status_code == 200 and active.json()["received"] is True, active.text
    assert (
        event(
            "evt_contract_active", "customer.subscription.updated", subscription
        ).status_code
        == 200
    )
    assert db.query(StripeWebhookEvent).count() == 1
    summary = client.get("/api/v1/billing/subscription", headers=qa.headers["admin"])
    assert summary.status_code == 200 and summary.json()["plan"] == "medium", (
        summary.text
    )
    assert summary.json()["internal_member_limits"]["workers"] > 0
    db.refresh(qa.other)
    assert qa.other.subscription_plan == "mega"
    assert (
        event(
            "evt_contract_failed",
            "invoice.payment_failed",
            {"customer": "cus_contract"},
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/billing/subscription", headers=qa.headers["admin"]).json()[
            "status"
        ]
        == "past_due"
    )
    assert (
        event(
            "evt_contract_paid", "invoice.paid", {"customer": "cus_contract"}
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/billing/subscription", headers=qa.headers["admin"]).json()[
            "status"
        ]
        == "active"
    )
    assert (
        event(
            "evt_contract_cancelled", "customer.subscription.deleted", subscription
        ).status_code
        == 200
    )
    cancelled = client.get("/api/v1/billing/subscription", headers=qa.headers["admin"])
    assert (
        cancelled.status_code == 200 and cancelled.json()["access_allowed"] is False
    ), cancelled.text
    assert len(requests) == 1
