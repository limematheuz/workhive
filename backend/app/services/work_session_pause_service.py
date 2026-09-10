from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo


def close_open_pause(
    db: Session,
    work_session: WorkSession,
    closed_at: datetime,
) -> None:
    if closed_at.tzinfo is None:
        closed_at = closed_at.replace(tzinfo=timezone.utc)
    active_pause = work_session_repo.get_active_pause_for_update(db, work_session.id)
    if active_pause is None:
        work_session.paused_at = None
        return

    pause_started_at = active_pause.started_at
    if pause_started_at.tzinfo is None:
        pause_started_at = pause_started_at.replace(tzinfo=timezone.utc)
    active_pause.ended_at = closed_at
    work_session.paused_seconds = max(
        0,
        int(work_session.paused_seconds or 0)
        + max(0, int((closed_at - pause_started_at).total_seconds())),
    )
    work_session.paused_at = None
    db.add(active_pause)
