from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.repositories import client as client_repo
from app.schemas.task_item import InvoiceableTaskResponse, TaskItemResponse
from app.services.company_client_service import find_company_client


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
    for task in tasks:
        client, billing_source, collaborator = resolve_invoice_client_for_task(
            db,
            company_id,
            task,
        )
        if client is None:
            continue
        base = TaskItemResponse.model_validate(task)
        responses.append(
            InvoiceableTaskResponse(
                **base.model_dump(),
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
            )
        )
    return responses
