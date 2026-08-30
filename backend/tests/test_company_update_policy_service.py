from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import company_update_policy_service


def _user(*, company_id: int | None, role_name: str) -> SimpleNamespace:
    return SimpleNamespace(
        company_id=company_id,
        role=SimpleNamespace(name=role_name),
    )


def test_company_member_can_access_only_own_company():
    company_update_policy_service.require_company_access(
        _user(company_id=8, role_name="admin"),
        8,
        action="access",
    )

    with pytest.raises(HTTPException) as error:
        company_update_policy_service.require_company_access(
            _user(company_id=8, role_name="admin"),
            9,
            action="update",
        )

    assert error.value.status_code == 403
    assert "update" in error.value.detail


def test_platform_superadmin_can_access_any_company():
    company_update_policy_service.require_company_access(
        _user(company_id=None, role_name="superadmin"),
        9,
        action="access",
    )


@pytest.mark.parametrize(
    ("changed_fields", "message"),
    [
        ({"is_active"}, "activation"),
        ({"subscription_plan"}, "access"),
    ],
)
def test_only_platform_superadmin_can_change_protected_company_fields(
    changed_fields,
    message,
):
    with pytest.raises(HTTPException) as error:
        company_update_policy_service.require_company_update_permissions(
            _user(company_id=8, role_name="admin"),
            changed_fields,
        )

    assert error.value.status_code == 403
    assert message in error.value.detail


def test_platform_subscription_transition_is_normalized():
    now = datetime(2026, 8, 13, tzinfo=timezone.utc)

    trial = company_update_policy_service.normalize_platform_subscription_update(
        {"subscription_plan": "trial"},
        platform_superadmin=True,
        now=now,
    )
    enterprise = company_update_policy_service.normalize_platform_subscription_update(
        {"subscription_plan": "mega", "trial_ends_at": now},
        platform_superadmin=True,
        now=now,
    )
    inactive = company_update_policy_service.normalize_platform_subscription_update(
        {"subscription_plan": "none"},
        platform_superadmin=True,
        now=now,
    )

    assert trial == {
        "subscription_plan": "top",
        "subscription_status": "trialing",
        "trial_started_at": now,
    }
    assert enterprise == {
        "subscription_plan": "mega",
        "subscription_status": "active",
        "trial_started_at": None,
        "trial_ends_at": None,
    }
    assert inactive == {
        "subscription_plan": "none",
        "subscription_status": "inactive",
        "trial_started_at": None,
        "trial_ends_at": None,
    }


def test_non_platform_payload_stays_unchanged_and_access_updates_revoke_sessions():
    payload = {"subscription_plan": "mega"}

    assert company_update_policy_service.normalize_platform_subscription_update(
        payload,
        platform_superadmin=False,
    ) is payload
    assert company_update_policy_service.requires_session_revocation({"is_active"})
    assert company_update_policy_service.requires_session_revocation(
        {"subscription_status"}
    )
    assert not company_update_policy_service.requires_session_revocation({"name"})
