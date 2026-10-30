from datetime import datetime, timezone

import pytest

from test_task_duplication import _source
from test_task_structure import _headers


@pytest.mark.parametrize("completed", [False, True])
@pytest.mark.parametrize("field", ["notes", "scheduled_start_at"])
@pytest.mark.parametrize("mixed", [False, True])
def test_full_form_edit_preserves_stored_checklist_and_completion(
    client, db, completed, field, mixed
):
    admin, _, task = _source(db, mixed=mixed)
    task.status = "completed" if completed else "pending"
    task.date_done = (
        datetime(2026, 1, 2, 12, tzinfo=timezone.utc) if completed else None
    )
    if not completed:
        task.checklist_items[-1].completed = False
        task.checklist_items[-1].assignments[0].status = "pending"
    db.commit()
    path = f"/api/v1/task-items/{task.id}"
    original = client.get(path, headers=_headers(admin)).json()
    value = "Nota revisada" if field == "notes" else "2026-11-02T11:35:00+00:00"
    response = client.patch(
        path,
        headers=_headers(admin),
        json={
            "description": original["description"],
            "user_id": original["user_id"],
            "status": original["status"],
            "date_done": "2026-10-30T12:00:00Z" if completed else None,
            field: value,
        },
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    if field == "scheduled_start_at":
        assert datetime.fromisoformat(updated[field]).replace(
            tzinfo=timezone.utc
        ) == datetime.fromisoformat(value)
    else:
        assert updated[field] == value
    for key in (
        "checklist_items",
        "assignments",
        "checklist_evidence",
        "description",
        "status",
        "date_done",
    ):
        assert updated[key] == original[key], key


@pytest.mark.parametrize("change_text", [False, True])
def test_description_cannot_complete_unfinished_structured_work(
    client, db, change_text
):
    admin, _, task = _source(db, mixed=True)
    task.status = "pending"
    task.checklist_items[-1].completed = False
    task.checklist_items[-1].assignments[0].status = "pending"
    db.commit()
    path = f"/api/v1/task-items/{task.id}"
    original = client.get(path, headers=_headers(admin)).json()
    response = client.patch(
        path,
        headers=_headers(admin),
        json={
            "description": original["description"]
            + ("\nNota adicional" if change_text else ""),
            "status": "completed",
        },
    )
    assert response.status_code == 409, response.text
    assert client.get(path, headers=_headers(admin)).json() == original


@pytest.mark.parametrize("field", ["description", "user_id"])
def test_real_definition_edits_preserve_steps_not_backed_by_markdown(client, db, field):
    admin, _, task = _source(db, mixed=True)
    task.status = "pending"
    db.commit()
    path = f"/api/v1/task-items/{task.id}"
    original = client.get(path, headers=_headers(admin)).json()
    value = (
        original["description"] + "\nOtra instrucción"
        if field == "description"
        else admin.id
    )
    response = client.patch(path, headers=_headers(admin), json={field: value})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated[field] == value
    assert updated["checklist_items"] == original["checklist_items"]
