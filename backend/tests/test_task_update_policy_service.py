from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.task_item import TaskItemUpdate
from app.services import task_update_policy_service


def test_reservation_links_reject_matching_checkout_and_arrival_ids(db):
    with pytest.raises(HTTPException) as error:
        task_update_policy_service.validate_reservation_links(
            db,
            location_id=1,
            checkout_reservation_id=12,
            next_reservation_id=12,
        )

    assert error.value.status_code == 400
    assert error.value.detail == "Checkout and next arrival must be different reservations"


def test_completed_task_reopens_without_retaining_completion_timestamp():
    task = SimpleNamespace(
        status="completed",
        description="",
        checklist_evidence=None,
        checklist_items=[],
    )

    update = task_update_policy_service.normalize_task_completion(
        task,
        TaskItemUpdate(status="progress"),
    )

    assert update.status == "progress"
    assert update.date_done is None


def test_external_snapshot_freezes_only_when_work_starts_or_finishes():
    task = SimpleNamespace(status="accepted")

    assert task_update_policy_service.should_freeze_external_snapshot(
        task,
        TaskItemUpdate(status="progress"),
        is_external=True,
    )
    assert not task_update_policy_service.should_freeze_external_snapshot(
        task,
        TaskItemUpdate(status="accepted"),
        is_external=True,
    )
    assert not task_update_policy_service.should_freeze_external_snapshot(
        task,
        TaskItemUpdate(status="progress"),
        is_external=False,
    )


def test_invoiced_task_remains_immutable_at_policy_boundary(monkeypatch, db):
    task = SimpleNamespace(company_id=7, is_invoiced=True)
    current_user = SimpleNamespace(company_id=7)
    monkeypatch.setattr(
        task_update_policy_service.task_item_repo,
        "get_task_item",
        lambda *_args: task,
    )

    with pytest.raises(HTTPException) as error:
        task_update_policy_service.require_mutable_task_for_update(
            db,
            current_user,
            task_item_id=9,
        )

    assert error.value.status_code == 409
    assert error.value.detail == "Invoiced tasks cannot be modified"
