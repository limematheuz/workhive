from datetime import datetime, timezone


def as_utc(value: datetime | None) -> datetime | None:
    """Interpret zone-less database/API instants as UTC and preserve offsets."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
