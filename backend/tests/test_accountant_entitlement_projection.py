from datetime import datetime, timedelta, timezone

import pytest

from app.models.external_access_grant import ExternalAccessGrant
from app.models.role import Role
from test_accountant_access import _company, _headers


@pytest.mark.parametrize("plan", ["top", "mega"])
def test_accountant_can_read_only_financial_feature_flags(client, db, plan):
    company = _company(db, "entitlements-" + plan)
    company.subscription_plan = plan
    actor, headers = _headers(
        db,
        company,
        db.query(Role).filter_by(name="external_portal").one().id,
        "accountant-flags-" + plan,
    )
    db.add(
        ExternalAccessGrant(
            company_id=company.id,
            user_id=actor.id,
            access_type="accountant",
            status="active",
        )
    )
    db.commit()
    response = client.get("/api/v1/companies/current/entitlements", headers=headers)
    assert response.status_code == 200, response.text
    rows = response.json()["entitlements"]
    assert {row["code"] for row in rows} == {
        "features.invoices",
        "features.profitability",
        "features.accountant_portal",
    }
    assert all(row["value"] is True for row in rows)
    assert (
        client.get(
            f"/api/v1/companies/{company.id}/plan-access", headers=headers
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/v1/companies/{company.id}/plan-access",
            headers=headers,
            json={
                "plan_code": "basic",
                "status": "inactive",
                "reason": "QA denied change",
            },
        ).status_code
        == 403
    )


@pytest.mark.parametrize("case", ["basic", "medium", "missing", "revoked", "expired"])
def test_entitlement_projection_does_not_admit_an_unentitled_or_inactive_portal(
    client, db, case
):
    company = _company(db, "entitlement-denial-" + case)
    company.subscription_plan = case if case in {"basic", "medium"} else "top"
    actor, headers = _headers(
        db,
        company,
        db.query(Role).filter_by(name="external_portal").one().id,
        "denied-flags-" + case,
    )
    if case != "missing":
        db.add(
            ExternalAccessGrant(
                company_id=company.id,
                user_id=actor.id,
                access_type="accountant",
                status="revoked" if case == "revoked" else "active",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1)
                if case == "expired"
                else None,
            )
        )
    db.commit()
    response = client.get("/api/v1/companies/current/entitlements", headers=headers)
    assert response.status_code == 403, response.text
