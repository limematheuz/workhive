import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.template_task import TemplateTask
from app.repositories import task_item as task_item_repo
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate
from app.services.calendar_task_owner_service import resolve_calendar_owner_user_id
from app.services.reservation_validation import get_location
from app.services import task_assignment_service


def ensure_location_access(
    db: Session,
    location_id: int,
    target_company_id: int | None,
) -> None:
    if target_company_id is None:
        return
    location = get_location(db, location_id)
    location_company_id = (
        location.owner_company_id
        or location.managing_company_id
        or (location.client.company_id if location.client else None)
    )
    if target_company_id == location_company_id:
        return
    existing_access = (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location_id,
            LocationCompanyAccess.company_id == target_company_id,
        )
        .first()
    )
    if existing_access:
        return
    db.add(
        LocationCompanyAccess(
            location_id=location_id,
            company_id=target_company_id,
            relationship_type="service_provider",
            can_manage_reservations=False,
            can_manage_tasks=True,
            can_view_sensitive=False,
        )
    )
    db.commit()


def _build_service_snapshot(
    db: Session,
    location_id: int,
    owner_company_id: int,
    guest_count: int,
) -> tuple[str, float | None, int | None, str]:
    assignments = (
        db.query(LocationTemplate)
        .join(TemplateTask)
        .filter(
            LocationTemplate.location_id == location_id,
            TemplateTask.company_id == owner_company_id,
            TemplateTask.is_active.is_(True),
        )
        .order_by(TemplateTask.id.asc())
        .all()
    )

    intro = f"Servicio solicitado para la salida de una reserva de {guest_count} huéspedes."
    checklist_lines: list[str] = []
    prices: list[float] = []

    for assignment in assignments:
        template = assignment.template
        template_name = assignment.custom_name or template.name
        template_description = (
            assignment.custom_description
            if assignment.custom_description is not None
            else template.description
        )
        template_price = (
            assignment.custom_price
            if assignment.custom_price is not None
            else template.default_price
        )
        if template_price is not None:
            prices.append(float(template_price))

        checklist_items: list[str] = []
        for line in (template_description or "").splitlines():
            match = re.match(r"^\s*[-*]?\s*\[\s*[xX\s]?\s*\]\s*(.+)$", line)
            if match:
                checklist_items.append(match.group(1).strip())

        if checklist_items:
            for item in checklist_items:
                label = item if len(assignments) == 1 else f"{template_name}: {item}"
                checklist_lines.append(f"- [ ] {label}")
        else:
            detail = " ".join((template_description or "").split())
            label = f"{template_name}: {detail}" if detail else template_name
            checklist_lines.append(f"- [ ] {label}")

    description = "\n".join([intro, "", *checklist_lines]).strip()
    price = sum(prices) if prices else None
    template_task_id = (
        assignments[0].template_task_id if len(assignments) == 1 else None
    )
    unit = (
        (assignments[0].custom_unit or assignments[0].template.unit)
        if len(assignments) == 1
        else "service"
    )
    return description, price, template_task_id, unit


def get_live_external_task_snapshot(
    db: Session,
    task: TaskItem,
) -> dict[str, object | None]:
    """Return issuer scope until the receiving company starts executing it."""
    if (
        task.status not in {"requested", "pending", "accepted"}
        or not task.checkout_reservation
        or task.is_invoiced
        or task.work_sessions
    ):
        return {}

    reservation = task.checkout_reservation
    if task.company_id == reservation.owner_company_id:
        return {}

    description, price, _, unit = _build_service_snapshot(
        db,
        task.location_id,
        reservation.owner_company_id,
        reservation.guest_count,
    )
    description = task_assignment_service.merge_checklist_assignments(
        task.description,
        description,
    )
    return {
        "description": description,
        "price": price,
        "quantity": 1.0 if price is not None else None,
        "unit": unit,
    }


def sync_checkout_task(
    db: Session,
    reservation: Reservation,
    location: Location,
    target_company_id: int,
    check_out_at: datetime,
    guest_count: int,
    cleaning_scheduled_at: datetime | None = None,
) -> TaskItem | None:
    checkout_task = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .first()
    )

    is_external = target_company_id != reservation.owner_company_id
    request_status = "requested" if is_external else "accepted"
    description, price, template_task_id, unit = _build_service_snapshot(
        db,
        location.id,
        reservation.owner_company_id,
        guest_count,
    )
    operational_template_id = None if is_external else template_task_id
    proposed_start_at = cleaning_scheduled_at or check_out_at
    calendar_owner_user_id = resolve_calendar_owner_user_id(db, target_company_id)
    title = f"Limpieza de salida - {location.name or ''}".strip()

    if checkout_task:
        if checkout_task.is_invoiced:
            return checkout_task

        target_changed = checkout_task.company_id != target_company_id
        if target_changed:
            checkout_task.company_id = target_company_id
        update_fields = {
            "title": title,
            "scheduled_start_at": proposed_start_at,
            "due_at": check_out_at,
            "user_id": calendar_owner_user_id,
        }
        if checkout_task.status == "requested" or target_changed:
            update_fields.update(
                {
                    "status": request_status,
                    "description": description,
                    "price": price,
                    "quantity": 1.0 if price is not None else None,
                    "unit": unit,
                    "template_task_id": operational_template_id,
                }
            )
        return task_item_repo.update_task_item(
            db,
            checkout_task,
            TaskItemUpdate(**update_fields),
        )

    return task_item_repo.create_task_item(
        db,
        target_company_id,
        TaskItemCreate(
            title=title,
            description=description,
            price=price,
            quantity=1.0 if price is not None else None,
            unit=unit,
            template_task_id=operational_template_id,
            location_id=location.id,
            user_id=calendar_owner_user_id,
            scheduled_start_at=proposed_start_at,
            due_at=check_out_at,
            service_context="checkout",
            checkout_reservation_id=reservation.id,
            status=request_status,
            priority="medium",
        ),
    )


def sync_location_reservation_chain(db: Session, location_id: int) -> None:
    reservations = (
        db.query(Reservation)
        .filter(
            Reservation.location_id == location_id,
            Reservation.status != "cancelled",
        )
        .order_by(Reservation.check_in_at.asc())
        .all()
    )

    for reservation in reservations:
        next_reservation = next(
            (
                candidate
                for candidate in reservations
                if candidate.id != reservation.id
                and candidate.check_in_at >= reservation.check_out_at
            ),
            None,
        )
        checkout_task = (
            db.query(TaskItem)
            .filter(TaskItem.checkout_reservation_id == reservation.id)
            .first()
        )
        if not checkout_task or checkout_task.is_invoiced:
            continue

        checkout_task.next_reservation_id = (
            next_reservation.id if next_reservation else None
        )
        earliest_start = reservation.check_out_at
        latest_start = next_reservation.check_in_at if next_reservation else None
        if (
            checkout_task.scheduled_start_at is None
            or checkout_task.scheduled_start_at < earliest_start
            or (
                latest_start is not None
                and checkout_task.scheduled_start_at > latest_start
            )
        ):
            checkout_task.scheduled_start_at = earliest_start
        checkout_task.due_at = (
            next_reservation.check_in_at
            if next_reservation
            else checkout_task.scheduled_start_at or reservation.check_out_at
        )
        checkout_task.priority = (
            "high"
            if next_reservation
            and next_reservation.check_in_at.date()
            == reservation.check_out_at.date()
            else "medium"
        )
        db.add(checkout_task)

    db.commit()
