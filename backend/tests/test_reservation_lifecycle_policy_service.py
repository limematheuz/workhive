from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import reservation_lifecycle_policy_service


def _task(*, status: str = "pending", is_invoiced: bool = False, task_id: int = 1):
    return SimpleNamespace(
        id=task_id,
        status=status,
        is_invoiced=is_invoiced,
        date_done=None,
        pricing_locked_at=None,
        worked_seconds_snapshot=None,
        checklist_items=[],
        assignments=[],
        checklist_evidence={},
        operational_notes=[],
        attachments=[],
        reported_issues=[],
    )


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


def test_provider_cannot_change_when_pending_task_has_a_report():
    with pytest.raises(HTTPException) as error:
        reservation_lifecycle_policy_service.require_provider_change_allowed(
            _task(status="pending"), has_persisted_activity=True
        )

    assert error.value.status_code == 409


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


@pytest.mark.parametrize("operation", ["delete", "disable_cleaning"])
def test_started_linked_work_cannot_be_removed(operation):
    with pytest.raises(HTTPException) as error:
        reservation_lifecycle_policy_service.require_linked_work_removable(
            _task(status="completed"), operation=operation
        )

    assert error.value.status_code == 409
    assert "must be preserved" in error.value.detail


def test_persisted_activity_protects_task_even_when_status_is_accepted():
    with pytest.raises(HTTPException) as error:
        reservation_lifecycle_policy_service.require_linked_work_removable(
            _task(status="accepted"), operation="delete", has_persisted_activity=True
        )

    assert error.value.status_code == 409


@pytest.mark.parametrize("field", ["checklist_evidence", "operational_notes", "attachments", "reported_issues"])
def test_task_evidence_counts_as_started_work(field):
    task = _task(status="accepted")
    setattr(task, field, {"item_1": {"answer": "yes"}} if field == "checklist_evidence" else ["recorded"])

    assert reservation_lifecycle_policy_service.linked_work_has_started(task)


def test_partially_completed_checklist_counts_as_started_work():
    task = _task(status="accepted")
    task.checklist_items = [SimpleNamespace(completed=True), SimpleNamespace(completed=False)]

    assert reservation_lifecycle_policy_service.linked_work_has_started(task)


def test_worker_progress_counts_as_started_work():
    task = _task(status="accepted")
    task.assignments = [SimpleNamespace(status="progress")]

    assert reservation_lifecycle_policy_service.linked_work_has_started(task)


def test_delete_is_allowed_when_no_linked_task_has_started():
    reservation_lifecycle_policy_service.require_all_linked_work_removable(
        [_task(), _task(status="accepted", task_id=2)],
        operation="delete",
    )
