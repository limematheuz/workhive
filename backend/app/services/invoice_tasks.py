from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.repositories import client as client_repo
from app.repositories import work_session as work_session_repo
from app.schemas.task_item import (
    InvoiceableTaskResponse,
    InvoiceableWorkerHours,
    TaskItemResponse,
)
from app.services.company_client_service import find_company_client
from app.services import task_billing_service


def resolve_invoice_client_for_task(
    db: Session,
    company_id: int,
    task: TaskItem,
) -> tuple[Client | None, str, Company | None]:
    checkout_reservation = task.checkout_reservation
    if (
        checkout_reservation
        and checkout_reservation.owner_company_id
        and checkout_reservation.owner_company_id != company_id
    ):
        issuer = (
            db.query(Company)
            .filter(Company.id == checkout_reservation.owner_company_id)
            .first()
        )
        if not issuer:
            return None, "external", None
        return (
            find_company_client(
                db,
                owner_company_id=company_id,
                partner_company=issuer,
            ),
            "external",
            issuer,
        )

    location = task.location
    if location and location.client_id:
        return (
            client_repo.get_client_by_id(
                db,
                location.client_id,
                company_id,
            ),
            "own",
            None,
        )
    return None, "own", None


def validate_task_for_invoice(
    db: Session,
    company_id: int,
    task_item_id: int,
    invoice_client_id: int,
    *,
    linked_invoice_id: int | None = None,
) -> TaskItem:
    """Lock and validate a task before linking it to an invoice.

    Task visibility is intentionally broader than billing ownership for
    collaboration workflows. Billing must therefore use a strict company_id
    predicate instead of the general task repository visibility query.
    """
    task = (
        db.query(TaskItem)
        .filter(
            TaskItem.id == task_item_id,
            TaskItem.company_id == company_id,
        )
        .with_for_update()
        .first()
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task item not found or does not belong to this company",
        )
    if task.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only completed task items can be invoiced",
        )
    task_billing_service.require_task_pricing_for_invoice(task)

    linked_to_current_invoice = linked_invoice_id is not None and any(
        item.invoice_id == linked_invoice_id for item in task.invoice_items
    )
    if task.is_invoiced and not linked_to_current_invoice:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task item is already linked to another invoice",
        )

    client, _, _ = resolve_invoice_client_for_task(db, company_id, task)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task item does not have a valid billing client",
        )
    if client.id != invoice_client_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task item must be invoiced to its assigned billing client",
        )
    return task


def validate_invoice_client_for_linked_tasks(
    db: Session,
    company_id: int,
    invoice_id: int,
    invoice_client_id: int,
    task_item_ids: list[int],
) -> None:
    for task_item_id in set(task_item_ids):
        validate_task_for_invoice(
            db,
            company_id,
            task_item_id,
            invoice_client_id,
            linked_invoice_id=invoice_id,
        )


def get_invoiceable_completed_tasks(
    db: Session,
    company_id: int,
) -> list[InvoiceableTaskResponse]:
    tasks = (
        db.query(TaskItem)
        .join(Location, TaskItem.location_id == Location.id)
        .outerjoin(
            Reservation,
            TaskItem.checkout_reservation_id == Reservation.id,
        )
        .filter(
            TaskItem.company_id == company_id,
            TaskItem.status == "completed",
            TaskItem.is_invoiced.is_(False),
        )
        .order_by(
            TaskItem.date_done.desc().nullslast(),
            TaskItem.created_at.desc(),
        )
        .all()
    )

    responses: list[InvoiceableTaskResponse] = []
    sessions_by_task: dict[int, list] = {task.id: [] for task in tasks}
    if sessions_by_task:
        for session in work_session_repo.get_sessions_by_tasks(
            db,
            list(sessions_by_task.keys()),
        ):
            if session.task_item_id in sessions_by_task:
                sessions_by_task[session.task_item_id].append(session)

    for task in tasks:
        if not task_billing_service.task_has_agreed_pricing(task):
            continue
        client, billing_source, collaborator = resolve_invoice_client_for_task(
            db,
            company_id,
            task,
        )
        if client is None:
            continue
        worked_seconds, worker_rows = task_billing_service.resolve_invoiceable_work(
            task,
            sessions_by_task.get(task.id, []),
        )
        base = TaskItemResponse.model_validate(task)
        base_data = base.model_dump(
            exclude={"pricing_mode", "price", "quantity", "unit"},
        )
        pricing_mode, agreed_price, agreed_quantity, agreed_unit = (
            task_billing_service.resolve_invoice_pricing_terms(task)
        )
        worked_hours = float(
            task_billing_service.billable_hours_from_seconds(worked_seconds)
        )
        responses.append(
            InvoiceableTaskResponse(
                **base_data,
                pricing_mode=pricing_mode,
                price=float(agreed_price),
                quantity=float(agreed_quantity),
                unit=agreed_unit,
                client_id=client.id,
                client_name=client.name,
                location_name=(
                    task.location.name
                    if task.location
                    else f"#{task.location_id}"
                ),
                billing_source=billing_source,
                collaborator_company_id=(
                    collaborator.id if collaborator else None
                ),
                collaborator_company_name=(
                    collaborator.name if collaborator else None
                ),
                worked_seconds=worked_seconds,
                worked_hours=worked_hours,
                workers=[
                    InvoiceableWorkerHours(**row) for row in worker_rows
                ],
            )
        )
    return responses


def apply_task_amounts_to_invoice_item(task: TaskItem, item_data):
    """Override client quantity/rate with backend-authoritative task billing."""
    quantity, unit_price = task_billing_service.resolve_task_invoice_quantity_and_rate(
        task
    )
    return item_data.model_copy(
        update={
            "quantity": float(quantity),
            "unit_price": float(unit_price),
        }
    )
