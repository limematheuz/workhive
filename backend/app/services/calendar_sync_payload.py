from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.task_item import TaskItem
from app.services import task_assignment_service


def utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def parse_google_datetime(value: dict | None) -> datetime | None:
    if not value:
        return None
    raw = value.get("dateTime")
    if raw:
        return datetime.fromisoformat(
            raw.replace("Z", "+00:00")
        ).astimezone(timezone.utc)
    raw_date = value.get("date")
    if raw_date:
        return datetime.fromisoformat(raw_date).replace(tzinfo=timezone.utc)
    return None


def target_user_ids(task: TaskItem) -> list[int]:
    user_ids: list[int] = []
    for user_id in (
        task.user_id,
        task.accepted_by_user_id,
        *task_assignment_service.hidden_assignee_ids(task.description),
    ):
        if user_id and user_id not in user_ids:
            user_ids.append(user_id)
    return user_ids


def task_is_scheduled(task: TaskItem) -> bool:
    return bool(task.scheduled_start_at or task.due_at)


def _status_label(status_value: str) -> str:
    return {
        "requested": "Solicitud pendiente",
        "pending": "Pendiente",
        "accepted": "Aceptada",
        "rejected": "Rechazada",
        "progress": "En progreso",
        "review": "En revisión",
        "completed": "Completada",
    }.get(status_value, status_value)


def _priority_label(priority_value: str) -> str:
    return {
        "low": "Baja",
        "medium": "Media",
        "high": "Alta",
    }.get(priority_value, priority_value)


def format_description_for_google(description: str | None) -> str:
    if not description:
        return ""
    from app.services.task_assignment_service import parse_checklist_line

    formatted_lines = []
    lines = description.splitlines()
    for line in lines:
        parsed = parse_checklist_line(line)
        if parsed:
            box = "✅" if parsed.checked else "⬜"
            meta_parts = []
            if parsed.assigned_user_name:
                meta_parts.append(parsed.assigned_user_name)
            if parsed.assigned_status:
                status_label = {
                    "pending": "pendiente",
                    "accepted": "aceptada",
                    "rejected": "rechazada",
                    "progress": "en progreso",
                    "review": "en revisión",
                    "completed": "completado",
                }.get(parsed.assigned_status, parsed.assigned_status)
                meta_parts.append(status_label)
            meta_str = f" ({' - '.join(meta_parts)})" if meta_parts else ""
            formatted_lines.append(f"{box} {parsed.text}{meta_str}")
        else:
            stripped = line.strip()
            if stripped.startswith("<!--") and stripped.endswith("-->"):
                continue
            formatted_lines.append(line)
    return "\n".join(formatted_lines)


def event_payload(task: TaskItem, user_id: int) -> dict:
    start = utc(task.scheduled_start_at or task.due_at)
    if not start:
        raise ValueError("Task has no calendar date")
    due = utc(task.due_at)
    end = due if due and due > start else start + timedelta(hours=1)
    location = task.location
    assignee = task.user
    description_parts = [
        format_description_for_google(task.description),
        task.notes or "",
        f"Estado WorkHive: {_status_label(task.status)}",
        f"Prioridad: {_priority_label(task.priority)}",
    ]
    if assignee:
        description_parts.append(
            f"Asignado a: {assignee.full_name or assignee.email}"
        )
    task_updated_at = utc(task.updated_at) or datetime.now(timezone.utc)
    return {
        "id": f"a{task.company_id:08x}{user_id:08x}{task.id:08x}",
        "summary": task.title,
        "description": "\n\n".join(part for part in description_parts if part),
        "location": (
            f"{location.name}, {location.address}, {location.city}"
            if location
            else None
        ),
        "start": {
            "dateTime": start.isoformat(),
            "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE,
        },
        "end": {
            "dateTime": end.isoformat(),
            "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE,
        },
        "sequence": max(0, int(task_updated_at.timestamp())),
        "extendedProperties": {
            "private": {
                "workhive_task_id": str(task.id),
                "workhive_company_id": str(task.company_id),
                "workhive_user_id": str(user_id),
                "workhive_updated_at": task_updated_at.isoformat(),
            }
        },
    }
