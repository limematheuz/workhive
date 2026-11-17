from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories.notification_acknowledgement import retire_task_assignments, retire_task_requests
from app.services import notification_service, task_assignment_service
from app.services import operational_recipient_service


MANAGEMENT_ROLES = {"admin", "manager"}


def _active_company_users(
    db: Session,
    company_id: int,
    role_names: set[str],
) -> list[User]:
    return (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(
            User.company_id == company_id,
            User.is_active.is_(True),
            Role.name.in_(role_names),
        )
        .order_by(User.id)
        .all()
    )


def operational_users(db: Session, company_id: int, location_id: int | None = None) -> list[User]:
    return operational_recipient_service.eligible_users(db, company_id, location_id=location_id)


def reconcile_assignment_notifications(
    db: Session, task: TaskItem, *, deleted: bool = False
) -> None:
    active = (
        set()
        if deleted or task.status in {"requested", "rejected", "completed"}
        else task_assignment_service.assigned_user_ids(task)
    )
    retire_task_assignments(
        db, company_id=task.company_id, task_id=task.id, active_user_ids=active
    )
    if deleted or task.status != "requested":
        retire_task_requests(db, company_id=task.company_id, task_id=task.id)


def notify_task_assignees(
    db: Session,
    task: TaskItem,
    user_ids: set[int],
) -> None:
    if not user_ids or task.status in {"requested", "rejected", "completed"}:
        return
    recipients = [user for user in operational_users(db, task.company_id, task.location_id)
                  if user.id in user_ids]
    if not recipients:
        return
    notification_service.notify_users(
        db,
        users=recipients,
        event_type="task.assigned",
        title="Nueva tarea asignada",
        message=task.title,
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard?taskId={task.id}",
    )


def _issuer_recipients(db: Session, reservation: Reservation) -> list[User]:
    users = _active_company_users(db, reservation.owner_company_id, MANAGEMENT_ROLES)
    if reservation.created_by and reservation.created_by.is_active:
        users.append(reservation.created_by)
    return list({user.id: user for user in users}.values())


def _external_reservation(task: TaskItem) -> Reservation | None:
    reservation = task.checkout_reservation
    if reservation is None or reservation.owner_company_id == task.company_id:
        return None
    return reservation


def notify_request_sent(
    db: Session,
    reservation: Reservation,
    task: TaskItem,
    *,
    commit: bool = True,
) -> None:
    recipients = operational_recipient_service.eligible_users(
        db, task.company_id, location_id=task.location_id, capabilities=("work.manage",)
    )
    notification_service.notify_users_once(
        db,
        users=recipients,
        event_type="task.requested",
        title="Nueva solicitud de servicio",
        message=task.title,
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard/reservations?tab=requests&taskId={task.id}",
        dedupe_key=f"task-requested:{task.id}",
        metadata={"reservation_id": reservation.id},
        commit=commit,
    )


def notify_request_accepted(db: Session, task: TaskItem, accepted_by: User) -> None:
    reservation = _external_reservation(task)
    if reservation is None:
        return
    notification_service.notify_users_once(
        db,
        users=_issuer_recipients(db, reservation),
        event_type="task.request.accepted",
        title="Solicitud aceptada",
        message=f"{task.title} · {accepted_by.full_name or accepted_by.email}",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard/reservations?reservationId={reservation.id}",
        dedupe_key=f"task-request-accepted:{task.id}",
        metadata={"reservation_id": reservation.id},
    )


def notify_request_rejected(db: Session, task: TaskItem, rejected_by: User) -> None:
    reservation = _external_reservation(task)
    if reservation is None:
        return
    notification_service.notify_users_once(
        db,
        users=_issuer_recipients(db, reservation),
        event_type="task.request.rejected",
        title="Solicitud rechazada",
        message=f"{task.title} · {rejected_by.full_name or rejected_by.email}",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard/reservations?reservationId={reservation.id}",
        dedupe_key=f"task-request-rejected:{task.id}",
        metadata={"reservation_id": reservation.id},
    )


def notify_work_started(
    db: Session,
    task: TaskItem,
    worker: User,
    session: WorkSession,
) -> None:
    reservation = _external_reservation(task)
    if reservation is None:
        return
    notification_service.notify_users_once(
        db,
        users=_issuer_recipients(db, reservation),
        event_type="task.work.started",
        title="Trabajo iniciado",
        message=f"{worker.full_name or worker.email} ha iniciado {task.title}",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard/reservations?reservationId={reservation.id}",
        dedupe_key=f"task-work-started:{session.id}",
        metadata={
            "reservation_id": reservation.id,
            "worker_id": worker.id,
            "started_at": session.start_time.isoformat(),
        },
    )


def notify_task_completed(db: Session, task: TaskItem) -> None:
    reconcile_assignment_notifications(db, task)
    db.commit()
    reservation = _external_reservation(task)
    if reservation is None:
        return
    notification_service.notify_users_once(
        db,
        users=_issuer_recipients(db, reservation),
        event_type="task.completed",
        title="Servicio completado",
        message=task.title,
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard/reservations?reservationId={reservation.id}",
        dedupe_key=f"task-completed:{task.id}",
        metadata={"reservation_id": reservation.id},
    )
