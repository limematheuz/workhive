from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.company import Company
from app.models.company_membership import CompanyMembership, Department, Team
from app.models.subscription_entitlement import (
    CompanySubscription,
    EntitlementChangeAudit,
)
from app.models.user import User
from app.services import company_entitlement_service, entitlement_service
from app.services import (
    client_service,
    invoice_service,
    location_service,
    quote_service,
    task_item_read_service,
    work_session_service,
)


def make_company(db, *, suffix: str, plan: str = "trial", status: str = "trialing"):
    now = datetime.now(timezone.utc)
    company = Company(
        name=f"Entitlement {suffix}",
        tax_id=f"ENT-{suffix}",
        address="Test address",
        phone=f"60000{suffix}",
        email=f"entitlement-{suffix}@example.com",
        subscription_plan=plan,
        subscription_status=status,
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


def test_trial_uses_top_entitlements_and_has_audited_subscription(db):
    company = make_company(db, suffix="trial")

    effective = entitlement_service.resolve_effective_entitlements(db, company)

    assert effective.plan_code == "top"
    assert effective.values["features.advanced_integrations"] is False
    assert effective.values["limits.internal_workers"] == 100
    assert db.query(CompanySubscription).filter_by(company_id=company.id).count() == 1
    assert (
        db.query(EntitlementChangeAudit).filter_by(company_id=company.id).count() == 1
    )


def test_current_override_wins_and_expired_override_does_not(db):
    company = make_company(db, suffix="override", plan="basic", status="active")
    now = datetime.now(timezone.utc)
    company_entitlement_service.set_company_entitlement_override(
        db,
        company_id=company.id,
        code="features.quality",
        value=True,
        reason="Pilot quality module",
        actor_user_id=None,
        starts_at=now,
        ends_at=now + timedelta(days=1),
    )
    db.commit()

    assert (
        entitlement_service.entitlement_value(db, company, "features.quality") is True
    )
    assert (
        entitlement_service.entitlement_value(
            db, company, "features.quality", now=now + timedelta(days=2)
        )
        is False
    )


def test_member_quota_is_applied_per_internal_access_class(db):
    company = make_company(db, suffix="members", plan="basic", status="active")
    member = User(
        email="entitlement-member@example.com",
        hashed_password="not-used-in-this-test",
        full_name="Entitlement member",
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(member)
    db.flush()
    db.add(
        CompanyMembership(
            company_id=company.id,
            user_id=member.id,
            access_class="admin",
            status="active",
        )
    )
    db.commit()

    with pytest.raises(HTTPException) as error:
        entitlement_service.require_internal_member_capacity(
            db, company_id=company.id, access_class="admin"
        )

    assert error.value.status_code == 409
    assert error.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"


def test_department_and_team_quotas_are_independent(db):
    company = make_company(db, suffix="structure", plan="basic", status="active")
    db.add_all(
        [
            Department(
                company_id=company.id,
                name="Operations",
                normalized_name="operations",
                code="OPS",
                is_active=True,
            ),
            Team(company_id=company.id, name="Team one", code="TEAM-1", is_active=True),
            Team(company_id=company.id, name="Team two", code="TEAM-2", is_active=True),
        ]
    )
    db.commit()

    with pytest.raises(HTTPException) as department_error:
        entitlement_service.require_department_capacity(db, company_id=company.id)
    with pytest.raises(HTTPException) as team_error:
        entitlement_service.require_team_capacity(db, company_id=company.id)

    assert department_error.value.status_code == 409
    assert team_error.value.status_code == 409


def test_feature_guard_blocks_a_module_not_in_the_plan(db):
    company = make_company(db, suffix="feature", plan="basic", status="active")

    with pytest.raises(HTTPException) as error:
        entitlement_service.require_feature(db, company, "features.inventory")

    assert error.value.status_code == 403
    assert (
        error.value.headers["X-WorkHive-Error-Code"]
        == "entitlement.feature_not_in_plan"
    )


def test_core_product_services_honor_a_company_feature_exception(db):
    company = make_company(db, suffix="core-gates", plan="basic", status="active")
    user = User(
        email="entitlement-core-gates@example.com",
        hashed_password="not-used-in-this-test",
        full_name="Core entitlement user",
        role_id=1,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    for code in (
        "features.clients",
        "features.locations",
        "features.invoices",
        "features.quotes",
        "features.work_orders",
        "features.time_tracking",
    ):
        company_entitlement_service.set_company_entitlement_override(
            db,
            company_id=company.id,
            code=code,
            value=False,
            reason="Disabled for commercial test",
            actor_user_id=None,
        )
    db.commit()

    blocked_operations = (
        lambda: client_service.get_clients(db, company.id),
        lambda: location_service.get_locations(db, company.id),
        lambda: invoice_service.get_invoices(db, company.id),
        lambda: quote_service.get_quotes(db, company.id),
        lambda: task_item_read_service.get_task_items(db, company.id),
        lambda: work_session_service.get_work_sessions(db, user.id),
    )
    for operation in blocked_operations:
        with pytest.raises(HTTPException) as error:
            operation()
        assert error.value.status_code == 403
        assert (
            error.value.headers["X-WorkHive-Error-Code"]
            == "entitlement.feature_not_in_plan"
        )
