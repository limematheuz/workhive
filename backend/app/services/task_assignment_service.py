import re
from collections import defaultdict, deque
from dataclasses import dataclass

from app.models.task_item import TaskItem


WORKER_STATUSES = {
    "pending",
    "accepted",
    "rejected",
    "progress",
    "completed",
    "review",
}

OPERATIONAL_VIEWER_STATUSES = frozenset(
    {"accepted", "progress", "review", "completed"}
)

CHECKLIST_PATTERN = re.compile(
    r"^(\s*[-*]?\s*\[\s*)([xX\s])(\s*\]\s*)(.+?)"
    r"(?:\s*\(@(\d+)(?::([^)]+))?\))?\s*$"
)
HIDDEN_ASSIGNEES_PATTERN = re.compile(
    r"<!--\s*workhive_assignees:([\s\S]*?)\s*-->"
)


@dataclass(frozen=True)
class ChecklistLine:
    prefix: str
    checked: bool
    closing: str
    text: str
    assigned_user_id: int | None
    assigned_user_name: str | None
    assigned_status: str | None


def _parse_assignment_meta(meta: str | None) -> tuple[str | None, str | None]:
    if not meta:
        return None, None
    parts = [part.strip() for part in meta.split(":") if part.strip()]
    if parts and parts[-1] in WORKER_STATUSES:
        return ":".join(parts[:-1]) or None, parts[-1]
    return meta.strip() or None, None


def parse_checklist_line(line: str) -> ChecklistLine | None:
    match = CHECKLIST_PATTERN.match(line)
    if not match:
        return None
    name, worker_status = _parse_assignment_meta(match.group(6))
    return ChecklistLine(
        prefix=match.group(1),
        checked=match.group(2).lower() == "x",
        closing=match.group(3),
        text=match.group(4).strip(),
        assigned_user_id=int(match.group(5)) if match.group(5) else None,
        assigned_user_name=name,
        assigned_status=worker_status,
    )


def parse_checklist(description: str | None) -> list[ChecklistLine]:
    return [
        parsed
        for line in (description or "").splitlines()
        if (parsed := parse_checklist_line(line)) is not None
    ]


def hidden_assignee_ids(description: str | None) -> set[int]:
    if not description:
        return set()
    ids: set[int] = set()
    for match in HIDDEN_ASSIGNEES_PATTERN.finditer(description):
        for value in match.group(1).split(","):
            try:
                ids.add(int(value.strip()))
            except ValueError:
                continue
    return ids


def merge_checklist_assignments(
    current_description: str | None,
    incoming_description: str | None,
) -> str:
    assignments_by_text: dict[str, deque[ChecklistLine]] = defaultdict(deque)
    for item in parse_checklist(current_description):
        if item.assigned_user_id is not None:
            key = re.sub(r"\s+", " ", item.text).strip().casefold()
            assignments_by_text[key].append(item)

    merged_lines: list[str] = []
    for line in (incoming_description or "").splitlines():
        incoming_item = parse_checklist_line(line)
        if incoming_item is None:
            merged_lines.append(line)
            continue

        key = re.sub(r"\s+", " ", incoming_item.text).strip().casefold()
        existing_assignments = assignments_by_text.get(key)
        if not existing_assignments:
            merged_lines.append(line)
            continue

        assigned_item = existing_assignments.popleft()
        name = (
            f":{assigned_item.assigned_user_name}"
            if assigned_item.assigned_user_name
            else ""
        )
        worker_status = (
            f":{assigned_item.assigned_status}"
            if assigned_item.assigned_status
            else ""
        )
        box = "x" if incoming_item.checked else " "
        merged_lines.append(
            f"{incoming_item.prefix}{box}{incoming_item.closing}"
            f"{incoming_item.text} "
            f"(@{assigned_item.assigned_user_id}{name}{worker_status})"
        )

    return "\n".join(merged_lines)


def _is_answered(task: TaskItem, checklist_index: int, item: ChecklistLine) -> bool:
    evidence = task.checklist_evidence or {}
    answer = (evidence.get(f"parsed_{checklist_index}") or {}).get("answer")
    return item.checked or item.assigned_status == "completed" or answer in {"yes", "no"}


def has_explicit_assignments(description: str | None) -> bool:
    return bool(hidden_assignee_ids(description)) or any(
        item.assigned_user_id is not None for item in parse_checklist(description)
    )


def is_user_assigned(task: TaskItem, user_id: int) -> bool:
    if task.user_id == user_id:
        return True
    if user_id in hidden_assignee_ids(task.description):
        return True
    return any(
        item.assigned_user_id == user_id
        for item in parse_checklist(task.description)
    )


def can_viewer_access_task(task: TaskItem, user_id: int) -> bool:
    return is_user_assigned(task, user_id)


def get_user_assignment_status(task: TaskItem, user_id: int) -> str:
    if task.status == "completed":
        return "completed"

    assigned = [
        (index, item)
        for index, item in enumerate(parse_checklist(task.description), start=1)
        if item.assigned_user_id == user_id
    ]
    if assigned:
        statuses = {item.assigned_status for _, item in assigned}
        if "rejected" in statuses:
            return "rejected"
        if "progress" in statuses:
            return "progress"
        if all(_is_answered(task, index, item) for index, item in assigned):
            return "completed"
        if "accepted" in statuses:
            return "accepted"
        return "pending"
    if user_id in hidden_assignee_ids(task.description):
        return task.status
    return task.status if task.user_id == user_id else "pending"


def set_user_assignment_status(
    description: str | None,
    user_id: int,
    next_status: str,
) -> tuple[str, int]:
    updated_count = 0
    updated_lines: list[str] = []
    for line in (description or "").splitlines():
        parsed = parse_checklist_line(line)
        if not parsed or parsed.assigned_user_id != user_id:
            updated_lines.append(line)
            continue

        updated_count += 1
        name = f":{parsed.assigned_user_name}" if parsed.assigned_user_name else ""
        box = "x" if parsed.checked else " "
        updated_lines.append(
            f"{parsed.prefix}{box}{parsed.closing}{parsed.text} "
            f"(@{user_id}{name}:{next_status})"
        )
    return "\n".join(updated_lines), updated_count


def user_checklist_is_complete(task: TaskItem, user_id: int) -> bool:
    checklist = parse_checklist(task.description)
    explicitly_assigned = [
        (index, item)
        for index, item in enumerate(checklist, start=1)
        if item.assigned_user_id == user_id
    ]
    if explicitly_assigned:
        return all(_is_answered(task, index, item) for index, item in explicitly_assigned)

    if user_id in hidden_assignee_ids(task.description):
        return all(
            _is_answered(task, index, item)
            for index, item in enumerate(checklist, start=1)
        )

    if task.user_id != user_id:
        return True
    owned_items = [
        (index, item)
        for index, item in enumerate(checklist, start=1)
        if item.assigned_user_id is None
    ]
    return not owned_items or all(_is_answered(task, index, item) for index, item in owned_items)


def all_task_checklist_items_are_complete(task: TaskItem) -> bool:
    checklist = parse_checklist(task.description)
    return bool(checklist) and all(
        _is_answered(task, index, item)
        for index, item in enumerate(checklist, start=1)
    )


def all_checklist_items_are_complete(description: str | None) -> bool:
    checklist = parse_checklist(description)
    return bool(checklist) and all(item.checked for item in checklist)


def has_in_progress_assignment(description: str | None) -> bool:
    return any(
        item.assigned_status == "progress"
        for item in parse_checklist(description)
    )


def validate_worker_description_update(
    current_description: str | None,
    new_description: str | None,
    user_id: int,
    owns_primary_assignment: bool,
) -> bool:
    current_lines = (current_description or "").splitlines()
    new_lines = (new_description or "").splitlines()
    if len(current_lines) != len(new_lines):
        return False

    for current_line, new_line in zip(current_lines, new_lines):
        current_item = parse_checklist_line(current_line)
        new_item = parse_checklist_line(new_line)
        if current_item is None or new_item is None:
            if current_line != new_line:
                return False
            continue

        if (
            current_item.text != new_item.text
            or current_item.assigned_user_id != new_item.assigned_user_id
            or current_item.assigned_user_name != new_item.assigned_user_name
            or current_item.assigned_status != new_item.assigned_status
        ):
            return False

        owns_line = (
            current_item.assigned_user_id == user_id
            or (
                current_item.assigned_user_id is None
                and owns_primary_assignment
            )
        )
        if not owns_line and current_line != new_line:
            return False

    return True
