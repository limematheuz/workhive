from app.models.notification import Notification
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from tests.test_task_security_delivery import _company, _headers, _location
from test_notification_scope_changes import _principal
from app.services.company_entitlement_service import set_company_entitlement_override
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    PlanEntitlement,
    SubscriptionPlan,
)
from app.services.entitlement_service import (
    boolean_entitlement_predicate,
    entitlement_value,
)


def test_foreign_report_without_requesting_company_stays_private(client, db):
    company = _company(db, "AuditRecipient")
    foreign = _company(db, "AuditForeign")
    user = _principal(db, company, "audit-recipient@example.test", "admin")
    foreign_user = _principal(db, foreign, "audit-foreign@example.test", "admin")
    location = _location(db, foreign)
    task = TaskItem(
        company_id=foreign.id,
        location_id=location.id,
        title="Foreign",
        unit="service",
        status="accepted",
    )
    db.add(task)
    db.flush()
    report = TaskReport(
        task_item_id=task.id,
        reporter_user_id=foreign_user.id,
        reporter_company_id=foreign.id,
        requesting_company_id=None,
        client_event_id="audit-report",
        report_type="note",
        description="Private foreign content",
        reporter_name="QA",
    )
    db.add(report)
    db.flush()
    notice = Notification(
        company_id=company.id,
        user_id=user.id,
        entity_type="task_report",
        entity_id=report.id,
        event_type="task.reported",
        title="Foreign content",
        message="Private foreign content",
        href="/dashboard/task-reports",
    )
    db.add(notice)
    db.commit()
    response = client.get("/api/v1/notifications/", headers=_headers(user))
    assert response.status_code == 200
    assert response.json() == []


def test_disabled_work_module_does_not_keep_operational_notices(client, db):
    company = _company(db, "AuditModule")
    user = _principal(db, company, "audit-module@example.test", "admin")
    location = _location(db, company)
    task = TaskItem(
        company_id=company.id,
        location_id=location.id,
        user_id=user.id,
        title="Disabled work",
        unit="service",
        status="accepted",
    )
    db.add(task)
    db.flush()
    db.add(
        Notification(
            company_id=company.id,
            user_id=user.id,
            entity_type="task_item",
            entity_id=task.id,
            event_type="task.assigned",
            title="Disabled work",
            message="QA",
            href="/dashboard",
        )
    )
    db.commit()
    set_company_entitlement_override(
        db,
        company_id=company.id,
        code="features.work_orders",
        value=False,
        reason="Isolated review",
        actor_user_id=user.id,
    )
    db.commit()
    headers = _headers(user)
    assert client.get("/api/v1/task-items/", headers=headers).status_code == 403
    response = client.get("/api/v1/notifications/", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
    operational = db.query(Notification).filter_by(user_id=user.id).one()
    assert (
        client.patch(
            f"/api/v1/notifications/{operational.id}/read", headers=headers
        ).status_code
        == 404
    )
    assert (
        client.get("/api/v1/notifications/?unread_only=false", headers=headers).json()
        == []
    )
    general = Notification(
        company_id=company.id,
        user_id=user.id,
        entity_type="system",
        event_type="system.general",
        title="General notice",
        message="QA",
        href="/dashboard/profile",
    )
    db.add(general)
    db.commit()
    assert [
        row["id"]
        for row in client.get("/api/v1/notifications/", headers=headers).json()
    ] == [general.id]
    set_company_entitlement_override(
        db,
        company_id=company.id,
        code="features.work_orders",
        value=True,
        reason="Restore access",
        actor_user_id=user.id,
    )
    db.commit()
    assert client.get("/api/v1/task-items/", headers=headers).status_code == 200
    assert {
        row["id"]
        for row in client.get("/api/v1/notifications/", headers=headers).json()
    } == {general.id, operational.id}
    db.refresh(operational)
    assert operational.read_at is None


@pytest.mark.parametrize(
    "plan", ["basic", "medium", "top", "mega", "custom", "pro", "invalid", " TOP "]
)
@pytest.mark.parametrize(
    "feature", ["features.work_orders", "features.quality", "features.api"]
)
def test_query_entitlement_matches_canonical_legacy_resolution(db, plan, feature):
    company = _company(db, "LegacyPredicate")
    company.subscription_plan = plan
    db.commit()
    expected = entitlement_value(db, company, feature) is True
    actual = db.scalar(select(boolean_entitlement_predicate(company.id, feature)))
    assert actual is expected


@pytest.mark.parametrize("feature", ["features.work_orders", "features.quality"])
@pytest.mark.parametrize(
    "case", ["none", "future", "expired", "deny", "grant", "tie", "future_after_deny"]
)
def test_query_entitlement_matches_override_order_and_exact_expiry(db, feature, case):
    company = _company(db, "OverrideSQL")
    company.subscription_plan = "basic"
    now = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)
    past = now - timedelta(days=1)
    entries = {
        "none": [],
        "future": [(now + timedelta(days=1), None, False)],
        "expired": [(past, now, False)],
        "deny": [(past, None, False)],
        "grant": [(past, None, True)],
        "tie": [(past, None, False), (past, None, True)],
        "future_after_deny": [
            (past, None, False),
            (now + timedelta(days=1), None, True),
        ],
    }[case]
    for starts, ends, value in entries:
        db.add(
            CompanyEntitlementOverride(
                company_id=company.id,
                code=feature,
                value_type="boolean",
                boolean_value=value,
                starts_at=starts,
                ends_at=ends,
                reason="Predicate contract",
            )
        )
    db.commit()
    from app.services.entitlement_service import resolve_effective_entitlements

    expected = (
        resolve_effective_entitlements(db, company, now=now).values[feature] is True
    )
    assert (
        db.scalar(select(boolean_entitlement_predicate(company.id, feature, now=now)))
        is expected
    )


def test_query_entitlement_uses_subscribed_version_and_denies_missing_feature(db):
    company = _company(db, "VersionPredicate")
    company.subscription_plan = "top"
    plan = SubscriptionPlan(
        code="basic", version=90, name="Versioned QA", is_active=False
    )
    db.add(plan)
    db.flush()
    db.add(
        PlanEntitlement(
            plan_id=plan.id,
            code="features.work_orders",
            value_type="boolean",
            boolean_value=False,
        )
    )
    db.add(CompanySubscription(company_id=company.id, plan_id=plan.id, status="active"))
    db.commit()
    for feature in ["features.work_orders", "features.quality"]:
        assert entitlement_value(db, company, feature) is False
        assert (
            db.scalar(select(boolean_entitlement_predicate(company.id, feature)))
            is False
        )
