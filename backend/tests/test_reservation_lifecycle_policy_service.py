from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import reservation_lifecycle_policy_service


def _task(*, status: str = "pending", is_invoiced: bool = False):
    return SimpleNamespace(status=status, is_invoiced=is_invoiced)


@pytest.mark.parametrize("status", ["accepted", "progress", "completed"])
def test_provider_cannot_change_after_linked_work_is_accepted_or_started(status):
    with pytest.raises(HTTPException) as error:
        reservation_lifecycle_policy_service.require_provider_change_allowed(
            _task(status=status)
        )

    assert error.value.status_code == 409


def test_provider_can_change_while_linked_work_is_still_pending():
    reservation_lifecycle_policy_service.require_provider_change_allowed(
        _task(status="pending")
    )


@pytest.mark.parametrize(
    ("operation", "message"),
    [
        ("cancel", "cannot be cancelled"),
        ("delete", "cannot be deleted"),
        ("disable_cleaning", "cannot be disabled"),
    ],
)
def test_invoiced_linked_work_cannot_be_removed(operation, message):
    with pytest.raises(HTTPException) as error:
        reservation_lifecycle_policy_service.require_linked_work_removable(
            _task(is_invoiced=True),
            operation=operation,
        )

    assert error.value.status_code == 409
    assert message in error.value.detail


def test_delete_is_allowed_when_no_linked_task_has_been_invoiced():
    reservation_lifecycle_policy_service.require_all_linked_work_removable(
        [_task(), _task(status="completed")],
        operation="delete",
    )
