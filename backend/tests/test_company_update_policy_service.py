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


def test_subscription_changes_are_reserved_for_the_dedicated_plan_workflow():
    with pytest.raises(HTTPException) as error:
        company_update_policy_service.require_company_update_permissions(
            _user(company_id=None, role_name="superadmin"),
            {"subscription_plan"},
        )

    assert error.value.status_code == 403
    assert "plan and access workflow" in error.value.detail


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


def test_company_activation_updates_revoke_sessions():
    assert company_update_policy_service.requires_session_revocation({"is_active"})
    assert not company_update_policy_service.requires_session_revocation({"subscription_status"})
    assert not company_update_policy_service.requires_session_revocation({"name"})
