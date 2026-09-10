from datetime import datetime, timezone

from app.models.work_session import WorkSession


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def elapsed_seconds(work_session: WorkSession, *, now: datetime) -> int:
    start = _as_utc(work_session.start_time)
    end = _as_utc(work_session.end_time or now)
    paused_seconds = max(0, int(work_session.paused_seconds or 0))
    if work_session.paused_at is not None:
        paused_at = _as_utc(work_session.paused_at)
        paused_seconds += max(0, int((end - paused_at).total_seconds()))
    return max(0, int((end - start).total_seconds()) - paused_seconds)


def elapsed_seconds_between(
    work_session: WorkSession,
    *,
    start: datetime,
    end: datetime,
) -> int:
    window_start = _as_utc(start)
    window_end = _as_utc(end)
    if window_end <= window_start:
        return 0

    paused_seconds = 0
    for pause in work_session.pauses:
        pause_start = _as_utc(pause.started_at)
        pause_end = _as_utc(pause.ended_at or window_end)
        overlap_start = max(window_start, pause_start)
        overlap_end = min(window_end, pause_end)
        if overlap_end > overlap_start:
            paused_seconds += int((overlap_end - overlap_start).total_seconds())
    return max(0, int((window_end - window_start).total_seconds()) - paused_seconds)
