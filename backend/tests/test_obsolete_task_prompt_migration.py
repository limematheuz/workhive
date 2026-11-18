import importlib.util
from pathlib import Path

from app.models.notification import Notification
from app.models.task_item import TaskItem
from test_task_direct_assignment import assignment_setup as assignment_setup  # noqa: F401


def test_historical_prompt_repair_preserves_actionable_events_and_read_history(
    db, monkeypatch, assignment_setup
):
    admin, worker, _, location, _ = assignment_setup
    notices = []
    for event, state, obsolete in [
        ("task.assigned", "pending", False),
        ("task.assigned", "completed", True),
        ("task.assigned", "rejected", True),
        ("task.requested", "requested", False),
        ("task.requested", "accepted", True),
        ("task.assigned", None, True),
        ("task.completed", None, False),
    ]:
        task = TaskItem(
            title="Historical prompt",
            unit="service",
            company_id=admin.company_id,
            location_id=location.id,
            status=state or "pending",
            user_id=worker.id,
        )
        db.add(task)
        db.flush()
        notice = Notification(
            user_id=worker.id,
            company_id=admin.company_id,
            event_type=event,
            title="History",
            message="History",
            entity_type="task_item",
            entity_id=task.id if state else task.id + 10000,
            href="/dashboard",
        )
        db.add(notice)
        notices.append((notice, obsolete))
    db.commit()
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic/versions/n5o6p7q8r9s_retire_obsolete_task_prompts.py"
    )
    spec = importlib.util.spec_from_file_location("prompt_repair", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    monkeypatch.setattr(migration.op, "execute", db.execute)
    migration.upgrade()
    db.expire_all()
    assert db.query(Notification).count() == len(notices)
    for notice, obsolete in notices:
        assert (notice.read_at is not None) == obsolete
    first = {notice.id: notice.read_at for notice, _ in notices}
    migration.upgrade()
    db.expire_all()
    assert {notice.id: notice.read_at for notice, _ in notices} == first
